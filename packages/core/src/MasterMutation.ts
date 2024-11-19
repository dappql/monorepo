import { useCallback, useMemo, useState } from 'react'

import { type Address } from 'viem'
import { useWriteContract } from 'wagmi'

import { useDappQL } from './Provider.js'
import { type MutationConfig } from './types.js'

export type MutationOptions =
  | {
      transactionName?: string
      address?: Address
    }
  | string

export function useMasterMutation<M extends string, Args extends readonly any[]>(
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
      tx.writeContractAsync(
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

  return useMemo(
    () => ({
      ...tx,
      send,
    }),

    [tx, send],
  )
}

export type MasterMutation = ReturnType<typeof useMasterMutation>
