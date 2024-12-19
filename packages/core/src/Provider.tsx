import { type ComponentType, createContext, useContext, useMemo, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Address } from 'viem'
import { type ResolvedRegister, WagmiProvider } from 'wagmi'
import { BlockSubscriptionManager, useBlockNumberSubscriber } from './blocksHandler.js'
import { MutationInfo, useTransactionUpdates } from './useTransactionUpdates.js'
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

/**
 * Props for the Provider component
 */
type ProviderProps = {
  children: any
  /** How many blocks to wait before refecthing queries*/
  blocksInterval?: number
  /** Optional function to resolve contract addresses */
  addressResolver?: AddressResolverFunction
  /** Optional component to handle address resolution */
  AddressResolverComponent?: ComponentType<AddressResolverProps>
} & MutationCallbacks

const Context = createContext<
  {
    blocksInterval: number
    addressResolver?: AddressResolverFunction
    onBlockChange: BlockSubscriptionManager['subscribe']
  } & MutationCallbacks
>({ onBlockChange: () => () => false, blocksInterval: 1 })

const queryClient = new QueryClient()

/**
 * Core provider component for DappQL
 * Manages contract address resolution and mutation callbacks
 */
function Provider({
  children,
  AddressResolverComponent,
  addressResolver,
  onMutationUpdate,
  blocksInterval = 1,
}: ProviderProps) {
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
      blocksInterval,
    }),
    [onBlockChange, handleMutationUpdate, addressResolverState.resolver, blocksInterval],
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
