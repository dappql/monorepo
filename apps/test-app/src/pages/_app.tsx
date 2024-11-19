import { DappQLProvider } from '@dappql/core'
import { getDefaultConfig, RainbowKitProvider } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { http } from 'wagmi'
import { sepolia } from 'wagmi/chains'
import { Provider } from '~/components/ui/provider'

const config = getDefaultConfig({
  appName: 'ToDo',
  projectId: process.env.NEXT_PUBLIC_PROJECT_ID as string,
  chains: [sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_CHAIN_URL),
  },
  ssr: true,
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <DappQLProvider config={config}>
      <RainbowKitProvider modalSize="compact">
        <Provider>
          <Component {...pageProps} />
        </Provider>
      </RainbowKitProvider>
    </DappQLProvider>
  )
}
