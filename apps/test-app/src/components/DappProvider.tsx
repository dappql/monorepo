import { DappQLProvider, MutationErrorInfo } from '@dappql/core'
import { connectorsForWallets, darkTheme, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import {
  argentWallet,
  coinbaseWallet,
  ledgerWallet,
  metaMaskWallet,
  omniWallet,
  rainbowWallet,
  trustWallet,
  uniswapWallet,
  walletConnectWallet,
} from '@rainbow-me/rainbowkit/wallets'
import { useCallback } from 'react'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { toaster } from '~/components/ui/toaster'

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Recommended',
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet, ledgerWallet, walletConnectWallet],
    },
    {
      groupName: 'Other',
      wallets: [argentWallet, trustWallet, omniWallet, uniswapWallet],
    },
  ],
  {
    appName: 'ToDo',
    projectId: process.env.NEXT_PUBLIC_PROJECT_ID as string,
  },
)

const config = createConfig({
  connectors,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_CHAIN_URL),
  },
  ssr: true,
})

export default function DappProvider({ children }: { children: React.ReactNode }) {
  const onError = useCallback((e: MutationErrorInfo) => {
    console.log(e)
    toaster.create({
      title: 'Something went wrong!',
      description: e.error.message,
      type: 'error',
    })
  }, [])
  return (
    <DappQLProvider config={config} onMutationError={onError}>
      <RainbowKitProvider
        modalSize="wide"
        showRecentTransactions
        theme={darkTheme({ accentColor: 'white', accentColorForeground: 'black' })}>
        {children}
      </RainbowKitProvider>
    </DappQLProvider>
  )
}
