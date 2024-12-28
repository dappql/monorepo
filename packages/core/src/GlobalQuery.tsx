import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { RequestCollection, AddressResolverFunction, Request, ReadContractsResult } from './types.js'
import { Abi, stringify } from 'viem'
import { Address } from 'viem'
import { useDappQL, useRefetchOnBlockChange } from './Context.js'
import { useReadContracts } from 'wagmi'
import { useCallKeys, useDefaultData, useRequestString, useResultData } from './queryHooks.js'

type Query = { collection: RequestCollection; callBack: (result: ReadContractsResult) => void }
type Call = {
  queryId: number
  abi: Abi
  functionName: string
  args: readonly any[]
  address: Address
}

type GlobalQuery = {
  index: Record<number, number>
  count: Record<number, number>
  calls: Call[]
}

export class QueryManager {
  private queries: Record<number, Query> = {}
  private currGlobal: GlobalQuery = { index: {}, count: {}, calls: [] }
  private queryId: number = 0
  private addressResolver?: AddressResolverFunction
  private onUpdate: (globalQuery: GlobalQuery) => void
  constructor(onUpdate: (globalQuery: GlobalQuery) => any, addressResolver?: AddressResolverFunction) {
    this.addressResolver = addressResolver
    this.onUpdate = onUpdate
  }

  addQuery(query: Query): number {
    const id = this.queryId++
    this.queries[id] = query
    this.aggregateQueries()
    return id
  }

  removeQuery(id: number): void {
    delete this.queries[id]
    this.aggregateQueries()
  }

  private aggregateQueries(): void {
    const newGlobalQuery = Object.keys(this.queries)
      .map((id) => {
        const queryId = Number(id)
        const query = this.queries[queryId]
        return Object.values(query.collection).map((request: Request) => {
          return {
            queryId,
            abi: request.getAbi(),
            functionName: request.method,
            args: request.args,
            address: request.address || this.addressResolver?.(request.contractName) || request.deployAddress!,
          } as Call
        })
      })
      .reduce(
        (acc, queries) => {
          if (queries.length) {
            acc.calls.push(...queries)
            acc.index[queries[0].queryId] = acc.calls.length - 1
            acc.count[queries[0].queryId] = queries.length
          }
          return acc
        },
        { index: {}, count: {}, calls: [] } as GlobalQuery,
      )

    if (stringify(newGlobalQuery) !== stringify(this.currGlobal)) {
      this.currGlobal = newGlobalQuery
      this.onUpdate(newGlobalQuery)
    }
  }

  setAddressResolver(resolver?: AddressResolverFunction) {
    this.addressResolver = resolver
    this.aggregateQueries()
  }

  onResult(result: ReadContractsResult) {
    // deaggregate result
    if (!result.isLoading && result.data) {
      Object.keys(this.queries).forEach((id) => {
        const queryId = Number(id)
        const query = this.queries[queryId]
        const chunk = result.data?.slice(
          this.currGlobal.index[queryId],
          this.currGlobal.index[queryId] + this.currGlobal.count[queryId],
        )
        if (chunk) {
          query.callBack({ isLoading: false, isError: result.isError, data: chunk, error: result.error })
        }
      })
    }
  }
}

const QueryContext = createContext<QueryManager>(new QueryManager(() => {}))

export default function GlobalQueryContext({ children }: { children: any }) {
  const { addressResolver, defaultBatchSize, watchBlocks, blocksRefetchInterval, onBlockChange } = useDappQL()
  const [query, setQuery] = useState<GlobalQuery>({ index: {}, count: {}, calls: [] })
  const queryManager = useMemo(() => new QueryManager(setQuery, addressResolver), [])

  useEffect(() => {
    queryManager.setAddressResolver(addressResolver)
  }, [addressResolver])

  const result = useReadContracts({
    contracts: query.calls,
    query: {
      notifyOnChangeProps: ['data', 'error'],
    },
    batchSize: defaultBatchSize,
  })

  useRefetchOnBlockChange(result.refetch, watchBlocks && !!query.calls.length, blocksRefetchInterval)

  useEffect(() => {
    queryManager.onResult(result)
  }, [result])

  return <QueryContext.Provider value={queryManager}>{children}</QueryContext.Provider>
}

export function useGlobalQuery<T extends RequestCollection>(
  requests: T,
): Omit<ReadContractsResult, 'data'> & {
  data: { [K in keyof T]: NonNullable<T[K]['defaultValue']> }
} {
  const requestString = useRequestString(requests)
  const queryManager = useContext(QueryContext)
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
