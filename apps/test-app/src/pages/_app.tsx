import { DappQLProvider } from '@dappql/core'
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
import type { AppProps } from 'next/app'
import { createConfig, http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { Provider } from '~/components/ui/provider'

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

export default function App({ Component, pageProps }: AppProps) {
  return (
    <DappQLProvider config={config}>
      <RainbowKitProvider
        modalSize="wide"
        showRecentTransactions
        theme={darkTheme({ accentColor: 'white', accentColorForeground: 'black' })}>
        <Provider>
          <Component {...pageProps} />
        </Provider>
      </RainbowKitProvider>
    </DappQLProvider>
  )
}
