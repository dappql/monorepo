import '@rainbow-me/rainbowkit/styles.css'
import type { AppProps } from 'next/app'
import { Provider } from '~/components/ui/provider'
import DappProvider from '~/components/DappProvider'
import { Toaster } from '~/components/ui/toaster'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider>
      <DappProvider>
        <Component {...pageProps} />
      </DappProvider>
      <Toaster />
    </Provider>
  )
}
