import { type ComponentType, createContext, useContext, useMemo, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Address } from 'viem'
import { type ResolvedRegister, WagmiProvider } from 'wagmi'
import { BlockSubscriptionManager, useBlockNumberSubscriber } from './blocksHandler.js'
import useTransactionUpdates, { MutationInfo } from './useTransactionUpdates.js'
export { MutationInfo } from './useTransactionUpdates.js'

/**
 * Callback functions for different mutation states
 */
export type MutationCallbacks = {
  /** Called when a mutation changes state */
  onMutationUpdate?: (info: MutationInfo) => any
}

/**
 * Function type for resolving contract names to addresses
 */
export type AddressResolverFunction = (contractName: string) => Address

/**
 * Props for the AddressResolver component
 */
export type AddressResolverProps = {
  /** Callback when resolver is ready */
  onResolved: (resolver: AddressResolverFunction) => any
}

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

type ProviderProps = BaseProviderProps &
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

const Context = createContext<
  {
    blocksRefetchInterval: number
    defaultBatchSize: number
    addressResolver?: AddressResolverFunction
    onBlockChange: BlockSubscriptionManager['subscribe']
    watchBlocks?: boolean
    simulateMutations?: boolean
  } & MutationCallbacks
>({ onBlockChange: () => () => false, blocksRefetchInterval: 1, defaultBatchSize: 1024 })

const queryClient = new QueryClient()

/**
 * Core provider component for DappQL
 * Manages contract address resolution and mutation callbacks
 */
function Provider({
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
    <Context.Provider value={value}>
      {AddressResolverComponent ? (
        <AddressResolverComponent
          onResolved={(resolver) => {
            setAddressResolver({ resolver })
          }}
        />
      ) : null}
      {!AddressResolverComponent || addressResolverState.resolver ? children : null}
    </Context.Provider>
  )
}

/**
 * Main DappQL provider that wraps necessary providers (Wagmi, React Query)
 * @param config Wagmi configuration
 * @param props Other provider props
 */
export function DappQLProvider({
  config,
  ...props
}: {
  config: ResolvedRegister['config']
} & ProviderProps) {
  return (
    <>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <Provider {...props} />
        </QueryClientProvider>
      </WagmiProvider>
    </>
  )
}

/**
 * Hook to access DappQL context
 * @returns Context containing current block number, address resolver, and mutation callbacks
 */
export function useDappQL() {
  return useContext(Context)
}
