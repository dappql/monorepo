import { useMemo, useRef } from 'react'
import { stringify } from 'viem'
import { ReadContractsResult, RequestCollection } from '../../shared/types.js'

export function useRequestString<T extends RequestCollection>(requests: T) {
  return useMemo(() => stringify(requests), [stringify(requests)])
}

export function useCallKeys<T extends RequestCollection>(requests: T, requestString: string) {
  return useMemo(() => Object.keys(requests) as (keyof T)[], [requestString])
}

export function useDefaultData<T extends RequestCollection>(requests: T, callKeys: (keyof T)[]) {
  type ResultData = { [K in keyof T]: NonNullable<T[K]['defaultValue']> }
  return useMemo(
    () =>
      callKeys.reduce((acc, k) => {
        acc[k] = requests[k].defaultValue!
        return acc
      }, {} as ResultData),
    [callKeys],
  )
}

export function useResultData<T extends RequestCollection>(
  requests: T,
  callKeys: (keyof T)[],
  result: ReadContractsResult,
  defaultData: { [K in keyof T]: NonNullable<T[K]['defaultValue']> },
) {
  type ResultData = { [K in keyof T]: NonNullable<T[K]['defaultValue']> }
  const previousData = useRef<ResultData>(defaultData)

  return useMemo(() => {
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
}

export type IteratorQueryResultData<T> = { value: NonNullable<T>; queryIndex: bigint }[]
export type IteratorQueryResult<T> = { data: IteratorQueryResultData<T>; isLoading?: boolean; error?: Error | null }
export function useIteratorQueryData<T>(
  total: bigint,
  result: {
    isLoading?: boolean
    isError?: boolean
    error?: Error | null
    data: Record<string, T>
  },
) {
  return useMemo(() => {
    if (total === 0n) return { data: [] as IteratorQueryResultData<T>, isLoading: false }
    const items = Object.keys(result.data)
      .map((k) => ({
        value: result.data[k] as NonNullable<T>,
        queryIndex: BigInt(k.replace('item', '')),
      }))
      .filter((i) => !!i.value) as IteratorQueryResultData<T>

    return {
      data: items,
      isLoading: result.isLoading,
      error: result.error,
    }
  }, [result.data, result.isLoading, result.error, total])
}
