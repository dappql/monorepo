import { useEffect, useMemo, useCallback } from 'react'
import { usePublicClient } from 'wagmi'

type Subscriber = (blockNumber: bigint) => void

export class BlockSubscriptionManager {
  private subscribers = new Set<Subscriber>()
  private currentBlock: bigint = 0n

  subscribe(callback: Subscriber) {
    this.subscribers.add(callback)
    // Immediately call with current value
    callback(this.currentBlock)
    return () => this.subscribers.delete(callback)
  }

  onBlockUptated(newBlock: bigint) {
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
        manager.onBlockUptated(blockNumber)
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
