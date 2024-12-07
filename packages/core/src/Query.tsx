import { useEffect, useMemo } from 'react'

import { type Client } from 'viem'
import { multicall } from 'viem/actions'
import { useBlockNumber, useReadContracts } from 'wagmi'

import { type AddressResolverFunction, useDappQL } from './Provider.js'
import { type Request, type RequestCollection } from './types.js'

export type QueryOptions = {
  blockNumber?: bigint
  refetchInterval?: number
}

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

export async function masterQuery<T extends RequestCollection>(
  requests: T,
  client: Client,
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

  const results = await multicall(client, { contracts: calls })
  const error = results.find((r) => r.error)

  const data = callKeys.reduce(
    (acc, k, index) => {
      acc[k] = results[index]?.result ?? requests[k]?.defaultValue!
      return acc
    },
    {} as {
      [K in keyof T]: NonNullable<T[K]['defaultValue']>
    },
  )

  return { data, error }
}

export type CountCall = Request & {
  defaultValue: bigint
}

export type GetItemCallFunction<T> = (index: bigint) => Request & {
  defaultValue: T
}

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
