/**
 * ContextQuery Module
 *
 * Manages the aggregation and distribution of multiple contract queries into a single global query.
 * This optimization reduces the number of RPC calls by batching multiple contract reads together.
 *
 * Key features:
 * - Query Aggregation: Combines multiple individual queries into a single batch
 * - Version Control: Manages race conditions in async responses
 * - Result Distribution: Routes results back to individual query callbacks
 * - Address Resolution: Flexible contract address resolution
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { Abi, stringify, Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { RequestCollection, AddressResolverFunction, Request, ReadContractsResult, QueryContextProps } from './types.js'
import { useDappQL, useRefetchOnBlockChange } from './Context.js'

type Query = { collection: RequestCollection; callBack: (result: ReadContractsResult) => void }
/**
 * Represents a single contract call within the global query
 */
type Call = {
  queryId: number
  abi: Abi
  functionName: string
  args: readonly any[]
  address: Address
}

/**
 * Represents the state of all aggregated queries
 */
type ContextQuery = {
  version: number // Increments with each query update
  count: Record<number, number> // Maps queryId to number of calls
  calls: Call[] // Array of all contract calls
}

/**
 * Manages the aggregation and distribution of contract queries
 */
export class ContextQueryManager {
  private queries: Record<number, Query> = {}
  private activeQueries: Set<number> = new Set()
  private currGlobal: ContextQuery = { version: 0, count: {}, calls: [] }
  private version = 0
  private queryId: number = 0
  private addressResolver?: AddressResolverFunction
  private onUpdate: (ContextQuery: ContextQuery) => void

  /**
   * Creates a new QueryManager instance
   * @param onUpdate - Callback triggered when the global query changes
   * @param addressResolver - Optional function to resolve contract addresses
   */
  constructor(onUpdate: (ContextQuery: ContextQuery) => any, addressResolver?: AddressResolverFunction) {
    this.addressResolver = addressResolver
    this.onUpdate = onUpdate
  }

  getContextQuery(): ContextQuery {
    return this.currGlobal
  }

  getVersion(): number {
    return this.version
  }

  addQuery(query: Query): number {
    const id = this.queryId++
    this.queries[id] = query
    this.activeQueries.add(id)
    this.aggregateQueries()
    return id
  }

  removeQuery(id: number): void {
    delete this.queries[id]
    this.activeQueries.delete(id)
    this.aggregateQueries()
  }

  private aggregateQueries(): void {
    const queryVersion = ++this.version

    const newContextQuery = Object.keys(this.queries)
      .map((id) => {
        const queryId = Number(id)
        const query = this.queries[queryId]
        return Object.values(query.collection).map(
          (request: Request) =>
            ({
              queryId,
              abi: request.getAbi(),
              functionName: request.method,
              args: request.args,
              address: request.address || this.addressResolver?.(request.contractName) || request.deployAddress!,
            }) as Call,
        )
      })
      .reduce(
        (acc, queries) => {
          if (queries.length) {
            acc.calls.push(...queries)

            acc.count[queries[0].queryId] = queries.length
          }
          return acc
        },
        { version: queryVersion, count: {}, calls: [] } as ContextQuery,
      )

    if (stringify(newContextQuery) !== stringify(this.currGlobal)) {
      this.currGlobal = newContextQuery
      if (this.version === queryVersion) {
        this.onUpdate(newContextQuery)
      }
    }
  }

  setAddressResolver(resolver?: AddressResolverFunction) {
    this.addressResolver = resolver
    this.aggregateQueries()
  }

  onResult(result: ReadContractsResult, version: number) {
    const shouldUpdate =
      !result.isLoading &&
      result.data &&
      result.data.length === this.currGlobal.calls.length &&
      version === this.currGlobal.version

    if (shouldUpdate) {
      let index = 0
      this.activeQueries.forEach((id) => {
        const queryId = Number(id)
        const query = this.queries[queryId]
        const count = this.currGlobal.count[queryId]
        if (!count) return //query has been removed

        const chunk = result.data?.slice(index, index + count)
        index += this.currGlobal.count[queryId]
        if (chunk) {
          query.callBack({ isLoading: false, isError: result.isError, data: chunk, error: result.error })
        }
      })
    }
  }
}

const QueryContext = createContext<ContextQueryManager>(new ContextQueryManager(() => {}))

/**
 * React Context provider for scoped query management
 * Handles the lifecycle of queries and their results
 */
export function ContextQueryProvider({
  children,
  defaultBatchSize,
  watchBlocks,
  blocksRefetchInterval,
}: { children: any } & QueryContextProps) {
  const { addressResolver, onBlockChange } = useDappQL()
  const [query, setQuery] = useState<ContextQuery>({ version: 0, count: {}, calls: [] })
  const queryManager = useMemo(() => new ContextQueryManager(setQuery, addressResolver), [])
  const [blockNumber, setBlockNumber] = useState<bigint>()

  useEffect(() => {
    const unsubscribe = onBlockChange((block) => {
      // Only set block number if it's a real block (not genesis)
      // This prevents querying at block 0 before the subscription initializes
      if (block > 0n) {
        setBlockNumber(block)
      }
    })
    return () => {
      unsubscribe()
    }
  }, [onBlockChange])

  useEffect(() => {
    queryManager.setAddressResolver(addressResolver)
  }, [addressResolver])

  const result = useReadContracts({
    contracts: query.calls,
    query: {
      notifyOnChangeProps: ['data', 'error'],
    },
    batchSize: defaultBatchSize,
    // Don't pass blockNumber until we have a real one - let wagmi use "latest"
    blockNumber: blockNumber && blockNumber > 0n ? blockNumber : undefined,
  })

  useRefetchOnBlockChange(result.refetch, watchBlocks && !!query.calls.length, blocksRefetchInterval)

  useEffect(() => {
    queryManager.onResult(result, query.version)
  }, [result])

  return <QueryContext.Provider value={queryManager}>{children}</QueryContext.Provider>
}

export function useQueryContextProvider() {
  return useContext(QueryContext)
}
