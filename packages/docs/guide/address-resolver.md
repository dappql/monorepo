# Address resolution

For dApps where contracts move (registries, proxies, upgrades, per-chain deployments), hardcoding addresses in `dap.config.js` is brittle. DappQL supports resolving contract addresses **at call time** via a resolver function wired into the provider.

The basics live in [Provider setup](/guide/provider). This page covers the deeper patterns.

## The resolver signature

```ts
type AddressResolverFunction = (contractName: string) => `0x${string}`
```

Called with the contract name exactly as it appears in your `dap.config.js` (the key in `contracts: { ... }`). Returns the deploy address for that contract.

Wire it into the provider:

```tsx
<DappQLProvider addressResolver={(name) => addresses[name]!}>
  {children}
</DappQLProvider>
```

Every `useContextQuery` / `useQuery` / `useMutation` that references a singleton contract consults this function to resolve the address. Templates still use `.at(addr)` or the `address` option (the resolver doesn't apply to templates since they're address-per-use).

## Static map — simplest case

```tsx
const addresses: Record<string, `0x${string}`> = {
  Token:    '0x...',
  Registry: '0x...',
  Oracle:   '0x...',
}

<DappQLProvider addressResolver={(name) => addresses[name]!}>
```

Use this when you know addresses at build time but want to keep them out of `dap.config.js` (e.g., because the file is committed and the addresses are per-environment).

## Per-chain resolution

```tsx
import { useChainId } from 'wagmi'

const addressesByChain: Record<number, Record<string, `0x${string}`>> = {
  1:    { Token: '0x...', Registry: '0x...' },    // Ethereum
  8453: { Token: '0x...', Registry: '0x...' },    // Base
  10:   { Token: '0x...', Registry: '0x...' },    // Optimism
}

function ProviderRoot({ children }) {
  const chainId = useChainId()
  const resolver = (name: string) => addressesByChain[chainId]?.[name]!

  return (
    <DappQLProvider addressResolver={resolver}>
      {children}
    </DappQLProvider>
  )
}
```

When the user switches chains, the resolver changes and every subsequent query resolves to the new chain's addresses.

::: warning
DappQL rebuilds the provider's internal value whenever its props change, so a new resolver function on every render causes stale-cache thrash. Wrap the resolver in `useCallback` or memoize the map:

```tsx
const resolver = useCallback(
  (name: string) => addressesByChain[chainId]?.[name]!,
  [chainId],
)
```
:::

## Async resolution — `AddressResolverComponent`

Some addresses only exist after an async lookup (calling an on-chain registry, fetching from an API, reading a subgraph). For that, use `AddressResolverComponent` — a component that renders alongside children, resolves asynchronously, and calls `onResolved` when ready:

```tsx
import { useContextQuery } from '@dappql/react'
import { UndyHq } from './src/contracts'

function Resolver({ onResolved }: { onResolved: (r: AddressResolverFunction) => void }) {
  const { data, isLoading } = useContextQuery({
    ledger:         UndyHq.call.getAddr(1n),
    missionControl: UndyHq.call.getAddr(2n),
    legoBook:       UndyHq.call.getAddr(3n),
  })

  useEffect(() => {
    if (isLoading) return
    onResolved((name) => ({
      Ledger:         data.ledger,
      MissionControl: data.missionControl,
      LegoBook:       data.legoBook,
    }[name])!)
  }, [isLoading, data])

  return null
}

<DappQLProvider AddressResolverComponent={Resolver}>
  {children}
</DappQLProvider>
```

**Children don't render until the resolver fires.** The provider holds back the tree until `onResolved` is called once, so by the time your components mount, every contract name has a valid address.

::: warning
`addressResolver` and `AddressResolverComponent` are mutually exclusive. Passing both throws at runtime.
:::

## From a published DappQL SDK

If you're consuming a published DappQL-generated SDK (like [`@underscore-finance/sdk`](https://github.com/underscore-finance/typescript-sdk)), the SDK typically exposes its own resolver after a one-time registry load:

```tsx
import Underscore from '@underscore-finance/sdk'

const underscore = new Underscore()
await underscore.loadAddresses()

<DappQLProvider addressResolver={underscore.addressResolver}>
```

One line wires the SDK's registry-backed resolution into every hook in your app. See [SDK generation](/guide/sdk-generation) for the publisher's side.

## Hybrid — some static, some resolved

The resolver is a plain function; combine sources freely:

```tsx
const staticAddresses = {
  Token: '0x...',
  USDC:  '0x...',
}

const dynamicAddresses = await registry.resolve()  // from an async source

const resolver = (name: string) =>
  staticAddresses[name] ?? dynamicAddresses[name] ?? fallback(name)

<DappQLProvider addressResolver={resolver}>
```

## Debugging

If a hook errors with "Contract X has no deploy address," check:

1. Is `X` declared in `contracts: {}` in `dap.config.js`?
2. Is it a template (`isTemplate: true`)? Templates ignore the resolver — use `.at(addr)` or the `address` option on mutations.
3. Does the resolver return a valid address for name `X`? Log it inside the function.
4. If using `AddressResolverComponent`, has `onResolved` been called yet? Children don't render until it does.

## Related

- [Provider setup](/guide/provider) — `addressResolver` and `AddressResolverComponent` basics.
- [Template contracts](/guide/templates) — `.at(addr)` for per-instance addressing.
- [SDK generation](/guide/sdk-generation) — publisher's side of registry-backed resolution.
