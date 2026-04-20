import { DappQLProvider, MutationInfo } from '@dappql/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useCallback } from 'react'
import { createConfig, http, WagmiProvider } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { toaster } from '~/components/ui/toaster'

const queryClient = new QueryClient()

const config = createConfig({
  connectors: [injected()],
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_CHAIN_URL),
  },
  ssr: true,
  pollingInterval: 10000,
})

export default function DappProvider({ children }: { children: React.ReactNode }) {
  const onMutationUpdate = useCallback((e: MutationInfo) => {
    console.log(e)
    toaster.create({
      id: e.id,
      title:
        e.status === 'error'
          ? 'Something went wrong!'
          : e.status === 'submitted'
            ? 'Transaction submitted!'
            : e.status === 'success'
              ? 'Transaction confirmed!'
              : 'Transaction signed!',
      description: (e.transactionName || e.contractName + '.' + e.functionName) + ' ' + (e.error?.message || ''),
      type: e.status === 'error' ? 'error' : 'success',
      duration: 10000,
    })
  }, [])

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <DappQLProvider onMutationUpdate={onMutationUpdate} defaultBatchSize={100_000} watchBlocks simulateMutations>
          {children}
        </DappQLProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
