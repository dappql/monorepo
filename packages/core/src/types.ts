import type { Abi, AbiFunction, Address, TransactionReceipt } from 'viem'

export type Request = {
  contractName: string
  method: AbiFunction['name']
  args?: readonly any[]
  address?: Address
  deployAddress?: Address
  defaultValue?: unknown
  chainId?: number
  getAbi: () => Abi
}
export type RequestCollection = Record<string, Request>

export type MutationConfig<M extends string, Args extends readonly any[]> = {
  contractName: string
  functionName: M
  deployAddress?: Address
  argsType?: Args
  getAbi: () => Abi
}
export type MutationCollection<T extends Record<string, MutationConfig<any, any>>> = T

export type ExtractArgs<T> = T extends (...args: infer P) => any ? P : never

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
  /** If true, the query will be refetched on new blocks */
  watchBlocks?: boolean
  /** Optional block number to query at a specific block */
  blockNumber?: bigint
  /** Optional interval (in ms) to refetch the data */
  refetchInterval?: number
  /** Optional batch size for multicalls */
  batchSize?: number
  /** If true, the query will be paused. */
  paused?: boolean
  /** How many blocks to wait before refetching the query */
  blocksRefetchInterval?: number
}

export type MutationInfo = {
  id: string
  status: 'submitted' | 'signed' | 'success' | 'error'
  account?: Address
  address: Address
  contractName: string
  functionName: string
  transactionName?: string
  txHash?: Address
  args?: readonly any[]
  error?: Error
  receipt?: TransactionReceipt
}

/**
 * Callback functions for different mutation states
 */
export type MutationCallbacks = {
  /** Called when a mutation changes state */
  onMutationUpdate?: (info: MutationInfo) => any
}

/**
 * Function type for resolving contract names to addresses
 */
export type AddressResolverFunction = (contractName: string) => Address

/**
 * Props for the AddressResolver component
 */
export type AddressResolverProps = {
  /** Callback when resolver is ready */
  onResolved: (resolver: AddressResolverFunction) => any
}

export type ReadContractsResult = {
  isLoading?: boolean
  isError?: boolean
  error?: Error | null
  data?:
    | (
        | {
            error?: undefined
            result: unknown
            status: 'success'
          }
        | {
            error: Error
            result?: undefined
            status: 'failure'
          }
      )[]
    | undefined
}

/**
 * Function type for generating item queries at specific indices
 */
export type GetItemCallFunction<T> = (index: bigint) => Request & {
  defaultValue: T
}

export type QueryContextProps = {
  /** Whether to update queries on new blocks */
  watchBlocks?: boolean
  /** How many blocks to wait before refecthing queries*/
  blocksRefetchInterval?: number
  /** Default batch size for multicalls */
  defaultBatchSize?: number
}
