import { type ComponentType, useMemo, useState } from 'react'

import { useBlockNumberSubscriber } from './blocksHandler.js'
import useTransactionUpdates from './useTransactionUpdates.js'
import { MutationCallbacks, AddressResolverFunction, AddressResolverProps } from './types.js'
import { DappQLContext } from './Context.js'
import GlobalQueryContext from './GlobalQueryManager.js'

export const ADDRESS_RESOLVER_ERROR =
  'Cannot provide both AddressResolverComponent and addressResolver. Please use only one of these props.'

/**
 * Props for the Provider component
 */
type BaseProviderProps = {
  children: any
  /** Whether to update queries on new blocks */
  watchBlocks?: boolean
  /** How many blocks to wait before refecthing queries*/
  blocksRefetchInterval?: number
  /** Default batch size for multicalls */
  defaultBatchSize?: number
  /** Whether to simulate mutations before sending them */
  simulateMutations?: boolean
} & MutationCallbacks

export type ProviderProps = BaseProviderProps &
  (
    | {
        /** Function to resolve contract addresses */
        addressResolver: AddressResolverFunction
        /** Component to handle address resolution - cannot be used with addressResolver */
        AddressResolverComponent?: never
      }
    | {
        /** Function to resolve contract addresses - cannot be used with AddressResolverComponent */
        addressResolver?: never
        /** Component to handle address resolution */
        AddressResolverComponent: ComponentType<AddressResolverProps>
      }
    | {
        /** Function to resolve contract addresses - optional if no resolution needed */
        addressResolver?: never
        /** Component to handle address resolution - optional if no resolution needed */
        AddressResolverComponent?: never
      }
  )

/**
 * Core provider component for DappQL
 * Manages contract address resolution and mutation callbacks
 */
export function DappQLProvider({
  children,
  AddressResolverComponent,
  blocksRefetchInterval = 1,
  defaultBatchSize = 1024,
  watchBlocks,
  simulateMutations,
  addressResolver,
  onMutationUpdate,
}: ProviderProps) {
  if (AddressResolverComponent && addressResolver) {
    throw new Error(ADDRESS_RESOLVER_ERROR)
  }

  const [addressResolverState, setAddressResolver] = useState<{
    resolver: AddressResolverFunction | undefined
  }>({ resolver: addressResolver })
  const onBlockChange = useBlockNumberSubscriber()
  const handleMutationUpdate = useTransactionUpdates(onMutationUpdate)

  const value = useMemo(
    () => ({
      onBlockChange,
      onMutationUpdate: handleMutationUpdate,
      addressResolver: addressResolverState.resolver,
      blocksRefetchInterval,
      defaultBatchSize,
      watchBlocks,
      simulateMutations,
    }),
    [
      onBlockChange,
      handleMutationUpdate,
      addressResolverState.resolver,
      blocksRefetchInterval,
      defaultBatchSize,
      watchBlocks,
      simulateMutations,
    ],
  )

  return (
    <DappQLContext.Provider value={value}>
      {AddressResolverComponent ? (
        <AddressResolverComponent
          onResolved={(resolver) => {
            setAddressResolver({ resolver })
          }}
        />
      ) : null}
      {!AddressResolverComponent || addressResolverState.resolver ? (
        <GlobalQueryContext>{children}</GlobalQueryContext>
      ) : null}
    </DappQLContext.Provider>
  )
}
