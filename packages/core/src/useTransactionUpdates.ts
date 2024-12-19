import { useCallback, useEffect, useRef } from 'react'
import { usePublicClient } from 'wagmi'
import { TransactionReceipt } from 'viem'
import { useStorageStringList } from './useStorageStringList.js'

export type MutationInfo = {
  id: string
  status: 'submitted' | 'signed' | 'success' | 'error'
  account?: string
  address: string
  contractName: string
  functionName: string
  transactionName?: string
  txHash?: string
  args?: readonly any[]
  error?: Error
  receipt?: TransactionReceipt
}

export function useTransactionUpdates(onUpdate?: (mutation: MutationInfo) => any) {
  const { items, addItem, removeItem } = useStorageStringList('pending-transactions', [])
  const client = usePublicClient()

  // Keep track of which transactions we're already watching
  const watchingTransactions = useRef(new Set<string>())
  // Store abort controllers for each transaction
  const abortControllers = useRef(new Map<string, AbortController>())

  // Handle new transaction submissions and updates
  const handleMutationUpdate = useCallback(
    (mutation: MutationInfo) => {
      onUpdate?.(mutation)

      if (!mutation.txHash) return

      const txInfo = JSON.stringify({
        id: mutation.id,
        txHash: mutation.txHash,
        account: mutation.account,
        address: mutation.address,
        contractName: mutation.contractName,
        functionName: mutation.functionName,
        transactionName: mutation.transactionName,
      })

      switch (mutation.status) {
        case 'signed':
          addItem(txInfo)
          break
        case 'success':
        case 'error':
          removeItem(txInfo)
          // Cleanup the watching state and abort controller
          watchingTransactions.current.delete(mutation.txHash)
          abortControllers.current.get(mutation.txHash)?.abort()
          abortControllers.current.delete(mutation.txHash)
          break
      }
    },
    [addItem, removeItem, onUpdate],
  )

  // Watch for new transactions
  useEffect(() => {
    if (!client || items.length === 0) return

    items.forEach(async (item) => {
      const txInfo = JSON.parse(item)
      const txHash = txInfo.txHash as `0x${string}`

      // Skip if we're already watching this transaction
      if (watchingTransactions.current.has(txHash)) return

      // Mark this transaction as being watched
      watchingTransactions.current.add(txHash)

      // Create an abort controller for this transaction
      const controller = new AbortController()
      abortControllers.current.set(txHash, controller)

      try {
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash,
        })

        // Only update if still watching this transaction
        if (watchingTransactions.current.has(txHash)) {
          const mutationUpdate = {
            ...txInfo,
            status: receipt.status === 'success' ? 'success' : 'error',
            error: receipt.status === 'success' ? undefined : new Error('Transaction failed'),
            receipt,
          }
          handleMutationUpdate(mutationUpdate)
        }
      } catch (error) {
        // Only log error if it's not due to the abort
        if (!controller.signal.aborted) {
          console.error(`Error watching transaction ${txHash}:`, error)
        }
      }
    })

    // Cleanup function
    return () => {
      // Abort all pending transaction watchers
      abortControllers.current.forEach((controller) => controller.abort())
      abortControllers.current.clear()
      watchingTransactions.current.clear()
    }
  }, [items, client, handleMutationUpdate])

  return handleMutationUpdate
}
