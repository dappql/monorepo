import { type ComponentType, createContext, useContext, useState } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AbiFunction, Address } from 'viem'
import { type ResolvedRegister, useBlockNumber, WagmiProvider } from 'wagmi'

type MutationInfo = {
  account?: string
  address: Address
  contractName: string
  functionName: AbiFunction['name']
  transactionName?: string
  submissionId: number
}

export type MutationSubmitInfo = MutationInfo & {
  args: readonly any[]
}

export type MutationSuccessInfo = MutationInfo & {
  data: Address
  variables: unknown
}
export type MutationErrorInfo = MutationInfo & {
  error: Error
  variables: unknown
}
export type MutationCallbacks = {
  onMutationSubmit?: (info: MutationSubmitInfo) => any
  onMutationSuccess?: (info: MutationSuccessInfo) => any
  onMutationError?: (info: MutationErrorInfo) => any
}

export type AddressResolverFunction = (contractName: string) => Address

type ContextData = {
  addressResolver?: AddressResolverFunction
  currentBlock: bigint
} & MutationCallbacks

const Context = createContext<ContextData>({ currentBlock: 0n })

export type AddressResolverProps = {
  onResolved: (resolver: AddressResolverFunction) => any
}

const queryClient = new QueryClient()

type ProviderProps = {
  children: any
  addressResolver?: AddressResolverFunction
  AddressResolverComponent?: ComponentType<AddressResolverProps>
} & MutationCallbacks

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

export function useDappQL() {
  return useContext(Context)
}
