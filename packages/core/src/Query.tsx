import { useEffect, useMemo, useRef } from 'react'

import { stringify, type PublicClient } from 'viem'
import { multicall } from 'viem/actions'
import { useReadContracts } from 'wagmi'

import { type AddressResolverFunction, useDappQL } from './Provider.js'
import { type Request, type RequestCollection } from './types.js'

/**
 * Configuration options for query operations
 */
export type QueryOptions = {
  /**
   * If true, the query will not automatically update when new blocks arrive.
   * Use this for data that you know won't change, like historical events
   * or immutable contract state.
   */
  isStatic?: boolean
  /** Optional block number to query at a specific block */
  blockNumber?: bigint
  /** Optional interval (in ms) to refetch the data */
  refetchInterval?: number
  /** How many blocks to wait before refetching the query */
  blocksRefetchInterval?: number
  /** Optional batch size for multicalls */
  batchSize?: number
  /** If true, the query will be paused. */
  paused?: boolean
}

const MIN_FETCH_INTERVAL = 2000

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
export function useQuery<T extends RequestCollection>(requests: T, options: QueryOptions = {}) {
  const { addressResolver, onBlockChange, blocksRefetchInterval, defaultBatchSize } = useDappQL()
  const lastFetchTime = useRef(0)
  const requestsChanged = useRef(false)
  const lastRequest = useRef<string>('')
  const { callKeys, calls } = useMemo(() => {
    requestsChanged.current = lastRequest.current !== stringify(requests)
    lastRequest.current = stringify(requests)
    const callKeys = Object.keys(requests) as (keyof T)[]
    const calls = Object.values(requests).map((req) => {
      return {
        abi: req.getAbi(),
        functionName: req.method,
        args: req.args,
        address: req.address || addressResolver?.(req.contractName) || req.deployAddress!,
      }
    })
    return { callKeys, calls }
  }, [stringify(requests)])

  type ResultData = { [K in keyof T]: NonNullable<T[K]['defaultValue']> }

  const defaultData = useMemo(
    () =>
      callKeys.reduce((acc, k) => {
        acc[k] = requests[k].defaultValue!
        return acc
      }, {} as ResultData),
    [callKeys],
  )

  const previousData = useRef<ResultData>(defaultData)
  const batchSize = options.batchSize ?? defaultBatchSize
  const enabled =
    !options.paused && (requestsChanged.current || Date.now() - lastFetchTime.current > MIN_FETCH_INTERVAL)

  console.log('---useQuery')
  console.log({ enabled, requestsChanged: requestsChanged.current, lastFetchTime: lastFetchTime.current })
  const result = useReadContracts({
    blockNumber: options.blockNumber,
    query: {
      enabled,
      refetchInterval: options.refetchInterval,
      notifyOnChangeProps: ['data', 'error'],
    },
    contracts: calls,
    batchSize,
  })

  useEffect(() => {
    if (!result.isLoading) {
      requestsChanged.current = false
    }
  }, [result.isLoading])

  const shouldRefetchOnBlockChange = !options.isStatic && !options.blockNumber && !options.refetchInterval
  const refetchInterval = options.blocksRefetchInterval ?? blocksRefetchInterval
  useEffect(() => {
    if (lastFetchTime.current === 0) {
      lastFetchTime.current = Date.now()
    }
    if (!options.paused && !options.isStatic && !options.blockNumber && !options.refetchInterval) {
      let lastBlockFetched = 0n
      const unsubscribe = onBlockChange((blockNumber) => {
        const timeSinceLastFetch = Date.now() - lastFetchTime.current
        const shouldRefetch =
          timeSinceLastFetch > MIN_FETCH_INTERVAL &&
          blockNumber > 0n &&
          blockNumber >= lastBlockFetched + BigInt(refetchInterval)
        console.log('---onBlockChange')
        console.log({ shouldRefetch, lastFetchTime, timeSinceLastFetch, blockNumber, lastBlockFetched })
        if (shouldRefetch) {
          result.refetch()
          lastBlockFetched = blockNumber
          lastFetchTime.current = Date.now()
        }
      })
      return () => {
        unsubscribe()
      }
    }
  }, [shouldRefetchOnBlockChange, refetchInterval, options.paused])

  const data = useMemo(() => {
    if (!result.error) {
      const newData = callKeys.reduce(
        (acc, k, index) => {
          acc[k] = result.data?.[index]?.result ?? previousData.current[k] ?? requests?.[k]?.defaultValue!
          return acc
        },
        {} as {
          [K in keyof T]: NonNullable<T[K]['defaultValue']>
        },
      )
      previousData.current = newData
      return newData
    }
    // During error, merge previous data with new default values
    return callKeys.reduce((acc, k) => {
      acc[k] = previousData.current[k] ?? requests[k].defaultValue!
      return acc
    }, {} as ResultData)
  }, [stringify(result.data), result.error, defaultData])

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
export function useSingleQuery<T extends Request>(request: T, options: QueryOptions = {}) {
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
  const error = results.find((r) => r.error)

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
 * Type definition for a contract call that returns a count
 */
export type CountCall = Request & {
  defaultValue: bigint
}

/**
 * Function type for generating item queries at specific indices
 */
export type GetItemCallFunction<T> = (index: bigint) => Request & {
  defaultValue: T
}

function buildIteratorQuery<T>(total: bigint, firstIndex: bigint, getItem: GetItemCallFunction<T>) {
  type FinalQuery = Record<string, ReturnType<GetItemCallFunction<T>>>
  const iterator = Array.from(new Array(Number(total)).keys())
  return iterator.reduce((acc, index) => {
    const realIndex = BigInt(index) + firstIndex
    acc[`item${realIndex}`] = getItem(realIndex)
    return acc
  }, {} as FinalQuery)
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
) {
  const { firstIndex = 0n, ...queryParams } = options

  const query = useMemo(() => buildIteratorQuery(total, firstIndex, getItem), [total, firstIndex, getItem])
  const result = useQuery(query, { ...queryParams, paused: queryParams.paused || total === 0n })
  type Result = { value: NonNullable<T>; queryIndex: bigint }[]
  return useMemo(() => {
    if (total === 0n) return { data: [] as Result, isLoading: false }
    const items = Object.keys(result.data)
      .map((k) => ({
        value: result.data[k] as NonNullable<T>,
        queryIndex: BigInt(k.replace('item', '')),
      }))
      .filter((i) => !!i.value) as Result

    return {
      data: items,
      isLoading: result.isLoading,
      error: result.error,
    }
  }, [result.data, result.isLoading, result.error, total])
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

  const result = await query(client, buildIteratorQuery(total, firstIndex, getItem), queryParams, addressResolver)

  return Object.keys(result).map((k) => ({
    value: result[k] as NonNullable<T>,
    queryIndex: BigInt(k.replace('item', '')),
  }))
}
