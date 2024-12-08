import { useCallback, useMemo, useState } from 'react'

import { type Address } from 'viem'
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

import { useDappQL } from './Provider.js'
import { type MutationConfig } from './types.js'

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
) {
  const { addressResolver, onMutationSubmit, onMutationSuccess, onMutationError } = useDappQL()

  const tx = useWriteContract()

  const address = useMemo(
    () =>
      optionsOrTransactionName && typeof optionsOrTransactionName !== 'string' && optionsOrTransactionName.address
        ? optionsOrTransactionName.address
        : addressResolver?.(config.contractName.toString()) || config.deployAddress!,
    [config.contractName, addressResolver, JSON.stringify(optionsOrTransactionName)],
  )

  const [submissionId, setSubmissionId] = useState(0)

  const options = useMemo(
    () =>
      typeof optionsOrTransactionName === 'string'
        ? { transactionName: optionsOrTransactionName }
        : optionsOrTransactionName,
    [optionsOrTransactionName],
  )

  const mutationInfo = {
    address,
    contractName: config.contractName,
    functionName: config.functionName,
    transactionName: options?.transactionName || '',
  }

  const send = useCallback(
    (...args: NonNullable<Args>) => {
      const sId = submissionId
      tx.writeContract(
        {
          abi: config.getAbi(),
          functionName: config.functionName,
          address,
          args,
        },
        {
          onSuccess: (data, variables) => {
            onMutationSuccess?.({
              ...mutationInfo,
              submissionId: sId,
              data,
              variables,
            })
          },
          onError: (error, variables) => {
            onMutationError?.({
              ...mutationInfo,
              submissionId: sId,
              error: new Error(error.message),
              variables,
            })
          },
        },
      )
      onMutationSubmit?.({ ...mutationInfo, submissionId: sId, args })
      setSubmissionId((id) => id + 1)
    },
    [address, tx, config],
  )

  const confirmation = useWaitForTransactionReceipt({ hash: tx.data })

  return useMemo(
    () => ({
      ...tx,
      confirmation,
      isLoading: tx.isPending || confirmation.isLoading,
      send,
    }),

    [tx, send, confirmation],
  )
}

/**
 * Return type of the useMutation hook
 * Includes transaction state, confirmation status, and send function
 */
export type Mutation = ReturnType<typeof useMutation>
