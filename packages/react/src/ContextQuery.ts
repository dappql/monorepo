import { useEffect, useMemo, useState } from 'react'

import { RequestCollection, ReadContractsResult, Request, GetItemCallFunction } from '../../shared/types.js'
import {
  IteratorQueryResult,
  useCallKeys,
  useDefaultData,
  useIteratorQueryData,
  useRequestString,
  useResultData,
} from './queryHooks.js'
import { useQueryContextProvider } from './ContextQueryManager.js'
import { buildIteratorQuery } from './buildIteratorQuery.js'
/**
 * Hook to execute contract queries through the global query manager
 *
 * All queries across your application using this hook will be automatically
 * aggregated into a single multicall query. This optimization significantly
 * reduces RPC calls by batching multiple contract reads together.
 *
 * For example, if you have:
 * - Component A reading balanceOf(user1)
 * - Component B reading balanceOf(user2)
 * - Component C reading totalSupply()
 *
 * These will be combined into a single multicall instead of 3 separate RPC calls.
 *
 * @param requests - Collection of contract requests to execute
 * @returns Object containing:
 *  - isLoading: Whether the query is in progress
 *  - isError: Whether an error occurred
 *  - data: The query results
 *  - error: Any error that occurred
 *
 * @example
 * ```tsx
 * const { isLoading, isError, data, error } = useContextQuery({
 *   balanceOf: { deployAddress: '0x...', method: 'balanceOf', args: [user1] },
 *   balanceOf2: { deployAddress: '0x...', method: 'balanceOf', args: [user2] },
 * })
 * ```
 */
export function useContextQuery<T extends RequestCollection>(
  requests: T,
): Omit<ReadContractsResult, 'data'> & {
  data: { [K in keyof T]: NonNullable<T[K]['defaultValue']> }
} {
  const requestString = useRequestString(requests)
  const queryManager = useQueryContextProvider()
  const [result, setResult] = useState<ReadContractsResult>({
    isLoading: true,
    isError: false,
    data: undefined,
    error: null,
  })

  useEffect(() => {
    const queryId = queryManager.addQuery({
      collection: requests,
      callBack: setResult,
    })
    return () => {
      queryManager.removeQuery(queryId)
    }
  }, [requestString])

  const callKeys = useCallKeys(requests, requestString)
  const defaultData = useDefaultData(requests, callKeys)
  const data = useResultData(requests, callKeys, result, defaultData)

  return useMemo(() => {
    return { isLoading: result.isLoading, isError: result.isError, data, error: result.error }
  }, [result.error, result.isLoading, data])
}

/**
 * React hook for querying a single contract request through the global query manager
 * @param request - The contract request to query
 * @returns Object containing:
 *  - isLoading: Whether the query is in progress
 *  - isError: Whether an error occurred
 *  - data: The query result
 *  - error: Any error that occurred
 *
 * @example
 * ```tsx
 * const { isLoading, isError, data, error } = useSingleContextQuery({ deployAddress: '0x...', method: 'balanceOf', args: [user1] })
 * ```
 */
export function useSingleContextQuery<T extends Request>(
  request: T,
): Omit<ReturnType<typeof useContextQuery>, 'data'> & { data: NonNullable<T['defaultValue']> } {
  const result = useContextQuery({ value: request })

  return useMemo(() => {
    return { ...result, data: result.data.value }
  }, [result])
}

/**
 * React hook for querying iterable data structures (like arrays) from smart contracts through the global query manager
 * @param total Total number of items to query
 * @param getItem Function that generates the query for a specific index
 * @param options Query configuration options including optional starting index
 * @returns Object containing array of query results and status
 * @example
 * ```ts
 * const { data, isLoading } = useIteratorQuery(10, (i) => contracts.myContract.getValue(i))
 * ```
 */
export function useIteratorContextQuery<T>(
  total: bigint,
  getItem: GetItemCallFunction<T>,
  firstIndex: bigint = 0n,
): IteratorQueryResult<T> {
  const query = useMemo(() => buildIteratorQuery(total, firstIndex, getItem), [total, firstIndex, getItem])
  const result = useContextQuery(query)
  return useIteratorQueryData(total, result)
}
