import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <link rel="icon" type="image/png" href="/icon.png" />
        <meta name="description" content="A minimal ToDo dApp powered by DappQL." />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
