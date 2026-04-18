# Provider setup

`DappQLProvider` is the React glue that wires wagmi, viem, and TanStack Query together with DappQL's read batching and mutation lifecycle. It belongs **inside** `WagmiProvider` and `QueryClientProvider`, at the root of your app.

## Minimal setup

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DappQLProvider } from '@dappql/react'

const queryClient = new QueryClient()

export function Root({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DappQLProvider>{children}</DappQLProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

## All options

| Option | Type | Purpose |
| --- | --- | --- |
| `watchBlocks` | `boolean` | Refetch every query on every new block. Default `false`. Turn on for DeFi dashboards where staleness matters. |
| `blocksRefetchInterval` | `number` | Refetch every *N* blocks when `watchBlocks` is on. Default `1`. |
| `defaultBatchSize` | `number` | Max calls per multicall chunk. Default `1024`. |
| `simulateMutations` | `boolean` | Run `eth_call` simulation before signing every mutation. Aborts on revert. Default `false`. |
| `onMutationUpdate` | `(info: MutationInfo) => void` | Single callback for every transaction lifecycle event — `'submitted' \| 'signed' \| 'success' \| 'error'`. The global place for toasts, analytics, receipts. |
| `addressResolver` | `(contractName: string) => Address` | Function that resolves contract names to addresses at call time. Use when addresses live in a registry or proxy. |
| `AddressResolverComponent` | `React.ComponentType` | Async version of `addressResolver` for when resolution itself needs hooks. **Mutually exclusive with `addressResolver`.** |

## Typical configurations

### DeFi dashboard — reactive, simulated, centralized tx UX

```tsx
<DappQLProvider
  watchBlocks
  simulateMutations
  onMutationUpdate={({ status, contractName, functionName, txHash, error }) => {
    if (status === 'submitted') toast.info(`Submitting ${functionName}…`)
    if (status === 'signed') toast.info(`${functionName} signed`, { txHash })
    if (status === 'success') toast.success(`${functionName} confirmed`)
    if (status === 'error') toast.error(error?.message ?? 'Transaction failed')
  }}
>
  {children}
</DappQLProvider>
```

One provider, every tx in the app gets consistent toasts and error handling. No per-component wiring.

### Registry-backed addresses

When your protocol uses a registry (like UndyHq, UndyRegistry, Diamond facets), resolve once and point the provider at it:

```tsx
const addresses = {
  Token:           '0x...',
  LootDistributor: '0x...',
  Ledger:          '0x...',
}

<DappQLProvider addressResolver={(name) => addresses[name]!}>
  {children}
</DappQLProvider>
```

Every `useContextQuery` call that references a registered contract automatically resolves its address via this function — no need to thread it through props.

### Async address resolution (needs hooks)

If resolving addresses requires a read itself (e.g. fetching them from an on-chain registry), use `AddressResolverComponent`:

```tsx
function Resolver({ onResolved }) {
  const { data } = useQuery({
    ledger: UndyHq.call.getAddr(1n),
    legoBook: UndyHq.call.getAddr(3n),
  })

  useEffect(() => {
    if (data) onResolved((name) => ({ Ledger: data.ledger, LegoBook: data.legoBook }[name]!))
  }, [data])

  return null
}

<DappQLProvider AddressResolverComponent={Resolver}>
  {children}
</DappQLProvider>
```

Children don't render until `onResolved` fires — the rest of your app always has a fully populated resolver.

::: warning
`addressResolver` and `AddressResolverComponent` are **mutually exclusive**. Passing both throws at runtime.
:::

## Consuming a published DappQL SDK

If you're building a frontend on top of an SDK that someone else generated with DappQL — for example [`@underscore-finance/sdk`](https://github.com/underscore-finance/typescript-sdk) — the SDK exposes its own address resolver. Wire it straight into the provider:

```tsx
import Underscore from '@underscore-finance/sdk'
import { DappQLProvider } from '@dappql/react'

const underscore = new Underscore()
await underscore.loadAddresses()  // on-chain registry lookup, once

<DappQLProvider watchBlocks addressResolver={underscore.addressResolver}>
  {children}
</DappQLProvider>
```

Now every `useContextQuery({ supply: UndyUsd.call.totalSupply() })` in the app resolves `UndyUsd`'s address via the SDK's registry-backed resolver. This is the canonical pattern for frontends on dappql-generated SDKs — see [SDK generation](/guide/sdk-generation) for the publisher's side.

## What to put outside the provider

- **Connect/disconnect UI** — wagmi hooks work independently; the connect button doesn't need to be inside `DappQLProvider`.
- **Routing, theme, analytics** — out.
- **Everything that calls `useContextQuery`, `useQuery`, `useMutation`, `useIteratorQuery`** — must be a descendant of `DappQLProvider`.

## Next

- [`useContextQuery`](/guide/reads/use-context-query) — the read hook you'll use most.
- [Mutations](/guide/mutations) — simulate, estimate, wait-for-receipt.
- [Address resolution](/guide/address-resolver) — deeper patterns for multi-deployment setups.
