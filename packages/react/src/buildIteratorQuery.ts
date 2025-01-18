'use strict'

import { GetItemCallFunction } from './types.js'

export function buildIteratorQuery<T>(total: bigint, firstIndex: bigint, getItem: GetItemCallFunction<T>) {
  type FinalQuery = Record<string, ReturnType<GetItemCallFunction<T>>>
  const iterator = Array.from(new Array(Number(total)).keys())
  return iterator.reduce((acc, index) => {
    const realIndex = BigInt(index) + firstIndex
    acc[`item${realIndex}`] = getItem(realIndex)
    return acc
  }, {} as FinalQuery)
}
