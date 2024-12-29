import { useContext, useEffect } from 'react'

import { createContext } from 'react'
import { MutationCallbacks } from './types.js'
import { AddressResolverFunction } from './types.js'
import { BlockSubscriptionManager } from './blocksHandler.js'

/**
 * Context for DappQL
 * @param children - React children
 * @returns DappQL context
 */
export const DappQLContext = createContext<
  {
    blocksRefetchInterval: number
    defaultBatchSize: number
    addressResolver?: AddressResolverFunction
    onBlockChange: BlockSubscriptionManager['subscribe']
    watchBlocks?: boolean
    simulateMutations?: boolean
  } & MutationCallbacks
>({ onBlockChange: () => () => false, blocksRefetchInterval: 1, defaultBatchSize: 1024 })

/**
 * Hook to access DappQL context
 * @returns Context containing current block number, address resolver, and mutation callbacks
 */
export function useDappQL() {
  return useContext(DappQLContext)
}

/**
 * Hook to refetch on block change
 * @param refetchFn - Function to refetch
 * @param watchBlocks - Whether to watch blocks
 * @param blocksRefetchInterval - Blocks refetch interval
 */
export function useRefetchOnBlockChange(refetchFn: () => any, watchBlocks = false, blocksRefetchInterval = 1) {
  const { onBlockChange } = useDappQL()
  useEffect(() => {
    if (!watchBlocks) return
    let lastBlockFetched = 0n
    const unsubscribe = onBlockChange((blockNumber) => {
      if (lastBlockFetched === 0n && blockNumber > 0n) {
        lastBlockFetched = blockNumber - 1n
      }
      const shouldRefetch = blockNumber > 0n && blockNumber >= lastBlockFetched + BigInt(blocksRefetchInterval)
      if (shouldRefetch) {
        refetchFn()
        lastBlockFetched = blockNumber
      }
    })
    return () => {
      unsubscribe()
    }
  }, [watchBlocks, blocksRefetchInterval])
}
