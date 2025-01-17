# Getting Started

DappQL is a powerful layer built on top of [wagmi](https://wagmi.sh) that simplifies smart contract interactions while adding type safety and query optimization. It works alongside wagmi rather than replacing it, enhancing your dApp development experience.

## Prerequisites

DappQL has the following peer dependencies:

```bash
"@tanstack/react-query": "^5.x"
"viem": "^2.x"
"wagmi": "^2.x"
```

## Installation

1. Install the CLI for generating contracts:

```bash
npm install -g dappql
```

2. Install the DappQL core package:

```bash
npm install @dappql/react wagmi viem @tanstack/react-query
```

## Setup

1. Set up your wagmi config and query client as usual:

```typescript
import { createConfig, http } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DappQLProvider } from '@dappql/react'

export const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

const queryClient = new QueryClient()
```

2. Wrap your application with the `DappQLProvider` component:

```tsx
<WagmiProvider config={config}>
  <QueryClientProvider client={queryClient}>
    <DappQLProvider>{/* ... */}</DappQLProvider>
  </QueryClientProvider>
</WagmiProvider>
```

3. Create a DappQL configuration file:

```javascript
// dapp.config.js
export default {
  targetPath: './src/contracts',
  contracts: {
    MyContract: {
      address: '0x...',
      abi: [...],
    },
  },
}
```

4. Generate contracts:

On the root of your project, same folder as your `dapp.config.js`, run:

```bash
dappql
```

This will generate the contracts in the `targetPath` specified in your `dapp.config.js`.

5. Use the generated contracts in your application:

```tsx
import { useQuery, useMutation } from '@dappql/react'
import { MyContract } from './src/contracts'

function MyComponent() {
  // DappQL automatically batches multiple reads into a single multicall
  const { data, isLoading } = useQuery({
    balance: contracts.MyContract.balanceOf(address),
    totalSupply: contracts.MyContract.totalSupply(),
  })

  // Type-safe mutations with built-in error handling
  const mutation = useMutation(contracts.MyContract.mint)

  if (isLoading) return <div>Loading...</div>

  return (
    <div>
      <p>Balance: {data.balance}</p>
      <p>Total Supply: {data.totalSupply}</p>
      <button onClick={() => mutation.send(1n)}>Mint</button>
    </div>
  )
}
```
