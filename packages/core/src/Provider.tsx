import { type ComponentType, createContext, useContext, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AbiFunction, Address } from 'viem'
import { type ResolvedRegister, useBlockNumber, WagmiProvider } from 'wagmi'

/**
 * Basic information about a contract mutation (write operation)
 */
type MutationInfo = {
  /** Connected wallet address */
  account?: string
  /** Contract address */
  address: Address
  /** Name of the contract */
  contractName: string
  /** Name of the function being called */
  functionName: AbiFunction['name']
  /** Optional human-readable name for the transaction */
  transactionName?: string
  /** Unique identifier for the submission */
  submissionId: number
}

/**
 * Information provided when a mutation is submitted
 */
export type MutationSubmitInfo = MutationInfo & {
  /** Arguments passed to the contract function */
  args: readonly any[]
}

/**
 * Information provided when a mutation succeeds
 */
export type MutationSuccessInfo = MutationInfo & {
  /** Transaction hash or other success data */
  data: Address
  /** Variables used in the mutation */
  variables: unknown
}

/**
 * Information provided when a mutation fails
 */
export type MutationErrorInfo = MutationInfo & {
  /** Error that occurred */
  error: Error
  /** Variables used in the mutation */
  variables: unknown
}

/**
 * Callback functions for different mutation states
 */
export type MutationCallbacks = {
  /** Called when a mutation is submitted to the network */
  onMutationSubmit?: (info: MutationSubmitInfo) => any
  /** Called when a mutation successfully completes */
  onMutationSuccess?: (info: MutationSuccessInfo) => any
  /** Called when a mutation fails */
  onMutationError?: (info: MutationErrorInfo) => any
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
  /** Optional function to resolve contract addresses */
  addressResolver?: AddressResolverFunction
  /** Optional component to handle address resolution */
  AddressResolverComponent?: ComponentType<AddressResolverProps>
} & MutationCallbacks

const Context = createContext<
  {
    addressResolver?: AddressResolverFunction
    currentBlock: bigint
  } & MutationCallbacks
>({ currentBlock: 0n })

const queryClient = new QueryClient()

/**
 * Core provider component for DappQL
 * Manages contract address resolution and mutation callbacks
 */
function Provider({
  children,
  AddressResolverComponent,
  addressResolver,
  onMutationSubmit,
  onMutationSuccess,
  onMutationError,
}: ProviderProps) {
  const [addressResolverState, setAddressResolver] = useState<{
    resolver: AddressResolverFunction | undefined
  }>({ resolver: addressResolver })

  const { data: currentBlock = 0n } = useBlockNumber({ watch: true })

  return (
    <Context.Provider
      value={{
        currentBlock,
        onMutationSubmit,
        onMutationSuccess,
        onMutationError,
        addressResolver: addressResolverState.resolver,
      }}>
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
