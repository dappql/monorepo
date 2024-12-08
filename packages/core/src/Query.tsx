import { useEffect, useMemo } from 'react'

import { type PublicClient } from 'viem'
import { multicall } from 'viem/actions'
import { useReadContracts } from 'wagmi'

import { type AddressResolverFunction, useDappQL } from './Provider.js'
import { type Request, type RequestCollection } from './types.js'

/**
 * Configuration options for query operations
 */
export type QueryOptions = {
  /** Optional block number to query at a specific block */
  blockNumber?: bigint
  /** Optional interval (in ms) to refetch the data */
  refetchInterval?: number
}

/**
 * React hook that executes multiple contract read calls in a single multicall
 * @param requests Collection of contract requests to execute
 * @param options Query configuration options
 * @returns Object containing query results and status
 */
export function useQuery<T extends RequestCollection>(requests: T, options: QueryOptions = {}) {
  const { addressResolver, currentBlock } = useDappQL()

  const { callKeys, calls } = useMemo(() => {
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
  }, [requests])

  const result = useReadContracts({
    blockNumber: options.blockNumber,
    query: {
      refetchInterval: options.refetchInterval,
    },
    contracts: calls,
  })

  useEffect(() => {
    if (currentBlock > 0n && !options.blockNumber && !options.refetchInterval) result.refetch()
  }, [currentBlock, options.blockNumber, options.refetchInterval])

  return useMemo(() => {
    const data = callKeys.reduce(
      (acc, k, index) => {
        acc[k] = result.data?.[index]?.result ?? requests?.[k]?.defaultValue!

        return acc
      },
      {} as {
        [K in keyof T]: NonNullable<T[K]['defaultValue']>
      },
    )

    return { ...result, data }
  }, [result.dataUpdatedAt, result.errorUpdatedAt, callKeys])
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

/**
 * React hook for querying iterable data structures (like arrays) from smart contracts
 * @param total Total number of items to query
 * @param getItem Function that generates the query for a specific index
 * @param options Query configuration options including optional starting index
 * @returns Object containing array of query results and status
 */
export function useIteratorQuery<T>(
  total: bigint,
  getItem: GetItemCallFunction<T>,
  options: QueryOptions & {
    firstIndex?: bigint
  } = {},
) {
  const { firstIndex = BigInt(0), ...queryParams } = options

  const query = useMemo(() => {
    type FinalQuery = Record<string, ReturnType<GetItemCallFunction<T>>>
    const iterator = Array.from(new Array(Number(total)).keys())
    return iterator.reduce((acc, index) => {
      const realIndex = BigInt(index) + firstIndex
      acc[`item${realIndex}`] = getItem(realIndex)
      return acc
    }, {} as FinalQuery)
  }, [total, getItem])

  const result = useQuery(query, queryParams)

  const items = useMemo(() => {
    if (result.isLoading || result.error) {
      return []
    }
    return Object.keys(result.data)
      .filter((k) => k.startsWith('item'))
      .map((k) => ({ value: result.data[k], queryIndex: BigInt(k.replace('item', '')) }))
  }, [result])

  return useMemo(() => {
    if (total === BigInt(0)) return { data: items, isLoading: false }
    return {
      data: items,
      isLoading: result.isLoading,
      error: result.error,
    }
  }, [items, total])
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
  const { firstIndex = BigInt(0), ...queryParams } = options

  type FinalQuery = Record<string, ReturnType<GetItemCallFunction<T>>>
  const iterator = Array.from(new Array(Number(total)).keys())

  const result = await query(
    client,
    iterator.reduce((acc, index) => {
      const realIndex = BigInt(index) + firstIndex
      acc[`item${realIndex}`] = getItem(realIndex)
      return acc
    }, {} as FinalQuery),
    options,
    addressResolver,
  )

  return Object.keys(result)
    .filter((k) => k.startsWith('item'))
    .map((k) => result[k])
}
