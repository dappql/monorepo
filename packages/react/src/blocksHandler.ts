import { useEffect, useMemo, useCallback } from 'react'
import { usePublicClient } from 'wagmi'

type Subscriber = (blockNumber: bigint) => void

export class BlockSubscriptionManager {
  private subscribers = new Set<Subscriber>()
  private currentBlock: bigint | undefined = undefined

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback)
    // Only call immediately if we have a real block number
    if (this.currentBlock !== undefined && this.currentBlock > 0n) {
      callback(this.currentBlock)
    }
    return () => this.subscribers.delete(callback)
  }

  onBlockUpdated(newBlock: bigint) {
    this.currentBlock = newBlock
    this.subscribers.forEach((sub) => sub(newBlock))
  }
}

export function useBlockNumberSubscriber() {
  const client = usePublicClient()
  const manager = useMemo(() => new BlockSubscriptionManager(), [])

  useEffect(() => {
    return client?.watchBlockNumber({
      onBlockNumber: (blockNumber) => {
        manager.onBlockUpdated(blockNumber)
      },
    })
  }, [client, manager])

  return useCallback(
    (callback: Subscriber) => {
      return manager.subscribe(callback)
    },
    [manager],
  )
}
