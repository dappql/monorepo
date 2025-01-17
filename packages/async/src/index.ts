import { Address, WalletClient, type PublicClient } from 'viem'
import { multicall, writeContract } from 'viem/actions'

import {
  AddressResolverFunction,
  GetItemCallFunction,
  type Request,
  type RequestCollection,
  MutationConfig,
} from '../../shared/types.js'
import { buildIteratorQuery } from './buildIteratorQuery.js'

export * from '../../shared/types.js'

/**
 * Executes multiple contract read calls in a single multicall (non-hook version)
 * @param client Viem public client instance
 * @param requests Collection of contract requests to execute
 * @param options Query configuration options
 * @param addressResolver Optional function to resolve contract addresses
 * @returns Promise containing query results
 */
export async function query<T extends RequestCollection>(
  client: PublicClient | WalletClient,
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
  client: PublicClient | WalletClient,
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
 * Queries iterable data structures from smart contracts (non-hook version)
 * @param client Viem public client instance
 * @param total Total number of items to query
 * @param getItem Function that generates the query for a specific index
 * @param options Query configuration options including optional starting index
 * @param addressResolver Optional function to resolve contract addresses
 * @returns Promise containing array of query results
 */
export async function iteratorQuery<T>(
  client: PublicClient | WalletClient,
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

/**
 * Creates a function that writes a contract mutation
 * @param client Viem wallet client instance
 * @param mutation The mutation configuration
 * @param options Optional configuration options
 * @returns Function that writes the mutation
 */
export function mutate<M extends string, Args extends readonly any[]>(
  client: WalletClient,
  mutation: MutationConfig<M, Args>,
  options: {
    address?: Address
    addressResolver?: AddressResolverFunction
  } = {},
) {
  if (!client.chain || !client.account) {
    throw new Error('Client must be connected to a chain and account')
  }

  const { address, addressResolver } = options
  return (...args: Args) =>
    client.writeContract({
      address: address || addressResolver?.(mutation.contractName) || mutation.deployAddress!,
      abi: mutation.getAbi(),
      functionName: mutation.functionName,
      args: args,
      chain: client.chain,
      account: client.account!,
    })
}
