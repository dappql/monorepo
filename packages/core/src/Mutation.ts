import { useCallback, useMemo } from 'react'

import { Account, Chain, Abi, SimulateContractReturnType, type Address } from 'viem'
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

import { MutationInfo, type MutationConfig } from './types.js'
import { useDappQL } from './Context.js'

function useMutationConfirmation(hash: `0x${string}` | undefined) {
  return useWaitForTransactionReceipt({ hash })
}

/**
 * Configuration options for mutations
 * Can be either a string (transaction name) or an object with additional options
 */
export type MutationOptions =
  | {
      /** Human-readable name for the transaction */
      transactionName?: string
      /** Override the contract address */
      address?: Address
      /** Whether to simulate the transaction before sending */
      simulate?: boolean
    }
  | string

/**
 * Hook for executing contract write operations (mutations)
 * @param config Configuration object containing contract details and ABI
 * @param optionsOrTransactionName Optional configuration or transaction name
 * @returns Object containing mutation state and send function
 *
 * @example
 * const mutation = useMutation({
 *   contractName: 'MyContract',
 *   functionName: 'setValue',
 *   getAbi: () => CONTRACT_ABI,
 *   deployAddress: '0x...'
 * }, 'Set Value')
 *
 * // Execute the mutation
 * mutation.send(newValue)
 */
export function useMutation<M extends string, Args extends readonly any[]>(
  config: MutationConfig<M, Args>,
  optionsOrTransactionName?: MutationOptions,
): ReturnType<typeof useWriteContract> & {
  confirmation: ReturnType<typeof useMutationConfirmation>
  isLoading: boolean
  send: (...args: Args) => void
  simulate: (
    ...args: Args
  ) => Promise<SimulateContractReturnType<Abi, M, Args, Chain, Account | undefined, Chain | undefined, `0x${string}`>>
  estimate: (...args: Args) => Promise<bigint>
} {
  const { addressResolver, onMutationUpdate, simulateMutations } = useDappQL()

  const { chain, address: account } = useAccount()

  const tx = useWriteContract()
  const client = usePublicClient()

  const address = useMemo(
    () =>
      optionsOrTransactionName && typeof optionsOrTransactionName !== 'string' && optionsOrTransactionName.address
        ? optionsOrTransactionName.address
        : addressResolver?.(config.contractName.toString()) || config.deployAddress!,
    [config.contractName, addressResolver, JSON.stringify(optionsOrTransactionName)],
  )

  const options = useMemo(
    () =>
      typeof optionsOrTransactionName === 'string'
        ? { transactionName: optionsOrTransactionName }
        : optionsOrTransactionName,
    [optionsOrTransactionName],
  )

  const mutationInfo = {
    account,
    address,
    contractName: config.contractName,
    functionName: config.functionName,
    transactionName: options?.transactionName || '',
  }

  const simulate = useCallback(
    async (...args: Args) => {
      if (!client) throw new Error('No client')
      return await client?.simulateContract({
        abi: config.getAbi(),
        functionName: config.functionName,
        address,
        args,
        account,
      })
    },
    [address, config, account, chain?.id, client],
  )

  const estimate = useCallback(
    async (...args: Args) => {
      if (!client) throw new Error('No client')
      return await client?.estimateContractGas({
        abi: config.getAbi(),
        functionName: config.functionName,
        address,
        args,
        account,
      })
    },
    [address, config, account, chain?.id, client],
  )

  const send = useCallback(
    (...args: NonNullable<Args>) => {
      const now = Date.now()
      const id = mutationInfo.address + mutationInfo.functionName + now.toString()
      if (!account || !chain?.id) {
        const error = !account ? 'No account connected' : 'Invalid chain'

        onMutationUpdate?.({
          ...mutationInfo,
          error: new Error(error),
          args,
          id,
          status: 'error',
        })
        return
      }

      const sendTx = () => {
        tx.writeContract(
          {
            abi: config.getAbi(),
            functionName: config.functionName,
            address,
            chainId: chain?.id,
            args,
          },
          {
            onSettled(data, error) {
              const status: MutationInfo['status'] = error ? 'error' : 'signed'
              onMutationUpdate?.({
                ...mutationInfo,
                id,
                args,
                error: error ? new Error(error.message) : undefined,
                status,
                txHash: data,
              })
            },
          },
        )

        onMutationUpdate?.({
          ...mutationInfo,
          id,
          args,
          status: 'submitted',
        })
      }

      if ((options?.simulate ?? simulateMutations) && client) {
        simulate(...(args as Args))
          .then(sendTx)
          .catch((error) => {
            onMutationUpdate?.({
              ...mutationInfo,
              id,
              args,
              error: new Error(error.message),
              status: 'error',
            })
          })
      } else {
        sendTx()
      }
    },
    [address, tx, config, account, chain?.id, options?.simulate, simulateMutations, client, simulate],
  )

  const confirmation = useMutationConfirmation(tx.data)

  return useMemo(
    () => ({
      ...tx,
      confirmation,
      isLoading: tx.isPending || confirmation.isLoading,
      send,
      simulate,
      estimate,
    }),

    [tx, send, confirmation, simulate, estimate],
  )
}

/**
 * Return type of the useMutation hook
 * Includes transaction state, confirmation status, and send function
 */
export type Mutation = ReturnType<typeof useMutation>
