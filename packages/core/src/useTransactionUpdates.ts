import { useCallback, useEffect } from 'react'
import { Address, PublicClient } from 'viem'
import { usePublicClient } from 'wagmi'
import { MutationInfo } from './types.js'
// Store refs for watching state outside the effect
const storageKey = 'pending-transactions'

class TransactionWatcher {
  private watchingTransactions = new Set<string>()
  private abortControllers = new Map<string, AbortController>()
  private client: PublicClient
  private onUpdate: (info: MutationInfo) => void

  constructor(client: PublicClient, onUpdate: (info: MutationInfo) => any) {
    this.client = client
    this.onUpdate = onUpdate

    window.addEventListener('storage', this.handleStorageChange)
    this.processExistingTransactions()
  }

  private handleStorageChange = (e: StorageEvent) => {
    if (e.key !== storageKey || !e.newValue) return
    this.processTransactions(JSON.parse(e.newValue))
  }

  private processExistingTransactions() {
    const existingData = localStorage.getItem(storageKey)
    if (existingData) {
      this.processTransactions(JSON.parse(existingData))
    }
  }

  private async processTransaction(txInfo: MutationInfo) {
    const txHash = txInfo.txHash as Address

    if (!txHash || this.watchingTransactions.has(txHash)) return

    this.watchingTransactions.add(txHash)
    const controller = new AbortController()
    this.abortControllers.set(txHash, controller)

    try {
      const receipt = await this.client.waitForTransactionReceipt({
        hash: txHash,
      })

      if (this.watchingTransactions.has(txHash)) {
        const mutationUpdate: MutationInfo = {
          ...txInfo,
          status: receipt.status === 'success' ? 'success' : 'error',
          error: receipt.status === 'success' ? undefined : new Error('Transaction failed'),
          receipt,
        }
        handleMutationUpdate(mutationUpdate, this.onUpdate)
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(`Error watching transaction ${txHash}:`, error)
      }
    }
  }

  private processTransactions(transactions: string[]) {
    transactions.forEach((item) => {
      const txInfo = JSON.parse(item)
      this.processTransaction(txInfo)
    })
  }

  watchTransaction(txInfo: any) {
    this.processTransaction(txInfo)
  }

  cleanup() {
    window.removeEventListener('storage', this.handleStorageChange)
    this.abortControllers.forEach((controller) => controller.abort())
  }
}

let globalWatcher: TransactionWatcher | null = null

function handleMutationUpdate(mutation: MutationInfo, onUpdate: (info: MutationInfo) => any) {
  onUpdate(mutation)

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

  const currentData = localStorage.getItem(storageKey)
  const transactions = currentData ? JSON.parse(currentData) : []

  switch (mutation.status) {
    case 'signed':
      // Add to storage and start watching
      const newTransactions = [...transactions, txInfo]
      localStorage.setItem(storageKey, JSON.stringify(newTransactions))
      globalWatcher?.watchTransaction(JSON.parse(txInfo))
      break
    case 'success':
    case 'error':
      // Remove from storage
      localStorage.setItem(storageKey, JSON.stringify(transactions.filter((t: string) => t !== txInfo)))
      break
  }
}

export default function useTransactionUpdates(onUpdate?: (info: MutationInfo) => any) {
  const client = usePublicClient()

  useEffect(() => {
    if (!client || !onUpdate) return

    globalWatcher = new TransactionWatcher(client, onUpdate)
    return () => {
      globalWatcher?.cleanup()
      globalWatcher = null
    }
  }, [client, onUpdate])

  return useCallback(
    (mutation: MutationInfo) => {
      if (!client || !onUpdate) return
      handleMutationUpdate(mutation, onUpdate)
    },
    [client, onUpdate],
  )
}
