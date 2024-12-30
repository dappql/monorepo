import { useMemo } from 'react'

import { type PublicClient } from 'viem'
import { multicall } from 'viem/actions'
import { useReadContracts } from 'wagmi'

import {
  AddressResolverFunction,
  GetItemCallFunction,
  QueryOptions,
  type Request,
  type RequestCollection,
} from './types.js'
import { useDappQL, useRefetchOnBlockChange } from './Context.js'
import {
  buildIteratorQuery,
  IteratorQueryResult,
  useDefaultData,
  useIteratorQueryData,
  useResultData,
} from './queryHooks.js'
import { useCallKeys } from './queryHooks.js'
import { useRequestString } from './queryHooks.js'

/**
 * React hook that executes multiple contract read calls in a single multicall
 * @param requests Collection of contract requests to execute
 * @param options Query configuration options
 * @returns Object containing query results and status
 * @example
 * ```ts
 * const { data, isLoading } = useQuery({
 *   value1: contracts.myContract.getValue(1, 2, 3),
 *   value2: contracts.myOtherContract.getOtherValue(4, 5, 6),
 * })
 * ```
 */
export function useQuery<T extends RequestCollection>(
  requests: T,
  options: QueryOptions = {},
): Omit<ReturnType<typeof useReadContracts>, 'data'> & {
  data: { [K in keyof T]: NonNullable<T[K]['defaultValue']> }
} {
  const { addressResolver, blocksRefetchInterval, defaultBatchSize, watchBlocks } = useDappQL()

  const requestString = useRequestString(requests)
  const callKeys = useCallKeys(requests, requestString)
  const calls = useMemo(() => {
    return Object.values(requests).map((req) => {
      return {
        abi: req.getAbi(),
        functionName: req.method,
        args: req.args,
        address: req.address || addressResolver?.(req.contractName) || req.deployAddress!,
        chainId: req.chainId,
      }
    })
  }, [requestString])
  const defaultData = useDefaultData(requests, callKeys)
  const result = useReadContracts({
    blockNumber: options.blockNumber,
    query: {
      enabled: !options.paused,
      refetchInterval: options.refetchInterval,
      notifyOnChangeProps: ['data', 'error'],
    },
    contracts: calls,
    batchSize: options.batchSize ?? defaultBatchSize,
  })
  const data = useResultData(requests, callKeys, result, defaultData)

  useRefetchOnBlockChange(
    result.refetch,
    (options.watchBlocks ?? watchBlocks) &&
      !options.paused &&
      !options.isStatic &&
      !options.blockNumber &&
      !options.refetchInterval,
    options.blocksRefetchInterval ?? blocksRefetchInterval,
  )

  return useMemo(() => {
    return { ...result, data }
  }, [result.error, result.isLoading, data])
}

/**
 * React hook that executes a single contract read call
 * This is a convenience wrapper around useQuery for when you only need to query one contract method
 * @param request The contract request to execute
 * @param options Query configuration options
 * @returns Object containing the query result and status, with data directly accessible (not nested in an object)
 * @example
 * ```ts
 * const { data, isLoading } = useSingleQuery(
 *   contracts.myContract.getValue(1, 2, 3)
 * )
 * ```
 */
export function useSingleQuery<T extends Request>(
  request: T,
  options: QueryOptions = {},
): Omit<ReturnType<typeof useQuery>, 'data'> & { data: NonNullable<T['defaultValue']> } {
  const result = useQuery({ value: request }, options)

  return useMemo(() => {
    return { ...result, data: result.data.value }
  }, [result])
}

/**
 * Executes multiple contract read calls in a single multicall (non-hook version)
 * @param client Viem public client instance
 * @param requests Collection of contract requests to execute
 * @param options Query configuration options
 * @param addressResolver Optional function to resolve contract addresses
 * @returns Promise containing query results
 */
export async function query<T extends RequestCollection>(
  client: PublicClient,
  requests: T,
  options: { blockNumber?: bigint } = {},
  addressResolver?: AddressResolverFunction,
) {
  const callKeys = Object.keys(requests) as (keyof T)[]
  const calls = Object.values(requests).map((req) => {
    return {
      address: req.address || addressResolver?.(req.contractName) || req.deployAddress!,
      abi: req.getAbi(),
      functionName: req.method,
      args: req.args,
    }
  })

  const results = await multicall(client, { contracts: calls, blockNumber: options.blockNumber })
  const error = results.find((r) => r.error)?.error

  if (error) {
    throw error
  }

  return callKeys.reduce(
    (acc, k, index) => {
      acc[k] = results[index]?.result ?? requests[k]?.defaultValue!
      return acc
    },
    {} as {
      [K in keyof T]: NonNullable<T[K]['defaultValue']>
    },
  )
}

/**
 * Executes a single contract read call (non-hook version)
 * @param client Viem public client instance
 * @param request The contract request to execute
 * @param options Query configuration options
 * @returns Promise containing the query result
 */
export async function singleQuery<T extends Request>(
  client: PublicClient,
  request: T,
  options: { blockNumber?: bigint } = {},
): Promise<NonNullable<T['defaultValue']>> {
  const result = await query(client, { value: request }, options)
  return result.value
}

/**
 * Type definition for a contract call that returns a count
 */
export type CountCall = Request & {
  defaultValue: bigint
}

/**
 * React hook for querying iterable data structures (like arrays) from smart contracts
 * @param total Total number of items to query
 * @param getItem Function that generates the query for a specific index
 * @param options Query configuration options including optional starting index
 * @returns Object containing array of query results and status
 * @example
 * ```ts
 * const { data, isLoading } = useIteratorQuery(10, (i) => contracts.myContract.getValue(i))
 * ```
 */
export function useIteratorQuery<T>(
  total: bigint,
  getItem: GetItemCallFunction<T>,
  options: QueryOptions & {
    firstIndex?: bigint
  } = {},
): IteratorQueryResult<T> {
  const { firstIndex = 0n, ...queryParams } = options
  const query = useMemo(() => buildIteratorQuery(total, firstIndex, getItem), [total, firstIndex, getItem])
  const result = useQuery(query, queryParams)
  return useIteratorQueryData(total, result)
}

/**
 * Queries iterable data structures from smart contracts (non-hook version)
 * @param client Viem public client instance
 * @param total Total number of items to query
 * @param getItem Function that generates the query for a specific index
 * @param options Query configuration options including optional starting index
 * @param addressResolver Optional function to resolve contract addresses
 * @returns Promise containing array of query results
 */
export async function iteratorQuery<T>(
  client: PublicClient,
  total: bigint,
  getItem: GetItemCallFunction<T>,
  options: {
    blockNumber?: bigint
    firstIndex?: bigint
  } = {},
  addressResolver?: AddressResolverFunction,
) {
  const { firstIndex = 0n, ...queryParams } = options
  if (total === 0n) return [] as { value: NonNullable<T>; queryIndex: bigint }[]

  const result = await query(client, buildIteratorQuery(total, firstIndex, getItem), queryParams, addressResolver)

  return Object.keys(result).map((k) => ({
    value: result[k] as NonNullable<T>,
    queryIndex: BigInt(k.replace('item', '')),
  }))
}
