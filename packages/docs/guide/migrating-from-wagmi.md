# Migrating from wagmi

If you already have a wagmi app, migrating to DappQL is **additive**, not a rewrite. You keep wagmi's configuration, connectors, chain setup, account hooks — everything that already works — and layer DappQL on top for contract reads and writes.

This page is a side-by-side: wagmi patterns on the left, their DappQL equivalents on the right.

## Setup — add a provider, keep everything

```tsx
// Before — pure wagmi
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
</WagmiProvider>

// After — wrap one more layer
<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <DappQLProvider watchBlocks>{children}</DappQLProvider>
  </QueryClientProvider>
</WagmiProvider>
```

`DappQLProvider` sits inside the existing providers. It doesn't replace them — it adds a contract-read query manager and mutation tracker that wagmi doesn't have natively. See [Provider setup](/guide/provider).

## Codegen — one-time

Wagmi's typed helpers come from your `wagmi.config.ts`. DappQL's come from `dap.config.js`:

```js
export default {
  targetPath: './src/contracts',
  isModule: true,
  contracts: {
    Token: { address: '0x...', abi: [...] },
    Vault: { address: '0x...', abi: [...] },
  },
}
```

Run `npx dappql`. You get a typed module per contract plus an `index.ts`. Keep using wagmi's generated code or viem's `getContract` for anything DappQL doesn't cover — they happily coexist.

## Reads

### Single read

```tsx
// Before
import { useReadContract } from 'wagmi'
import { tokenAbi } from './abis'

const { data: balance } = useReadContract({
  address: TOKEN_ADDRESS,
  abi: tokenAbi,
  functionName: 'balanceOf',
  args: [account],
})

// After
import { Token } from './src/contracts'
import { useSingleContextQuery } from '@dappql/react'

const { data: balance } = useSingleContextQuery(
  Token.call.balanceOf(account),
)
```

Same result, 40% less boilerplate, fully typed.

### Multiple reads (this is where DappQL shines)

```tsx
// Before — four hook calls, four RPCs
const { data: balance } = useReadContract({ address, abi, functionName: 'balanceOf', args: [account] })
const { data: symbol } = useReadContract({ address, abi, functionName: 'symbol' })
const { data: decimals } = useReadContract({ address, abi, functionName: 'decimals' })
const { data: total } = useReadContract({ address, abi, functionName: 'totalSupply' })

// Or with useReadContracts — one RPC but verbose
const { data } = useReadContracts({
  contracts: [
    { address, abi, functionName: 'balanceOf', args: [account] },
    { address, abi, functionName: 'symbol' },
    { address, abi, functionName: 'decimals' },
    { address, abi, functionName: 'totalSupply' },
  ],
})
// data[0].result, data[1].result, ... unlabeled

// After — one RPC, labeled, typed per-field
const { data } = useContextQuery({
  balance:  Token.call.balanceOf(account),
  symbol:   Token.call.symbol(),
  decimals: Token.call.decimals(),
  total:    Token.call.totalSupply(),
})
```

And the killer feature: **`useContextQuery` batches across your entire component tree**, not just within one hook. Three components each calling `useContextQuery` → one multicall. Wagmi's `useReadContracts` can't do that without lifting state.

### Historical reads

```tsx
// Before
useReadContract({ address, abi, functionName: 'totalSupply', blockNumber: 44_500_000n })

// After
useQuery({ supply: Token.call.totalSupply() }, { blockNumber: 44_500_000n })
```

## Writes

### Basic write

```tsx
// Before
import { useWriteContract } from 'wagmi'

const { writeContract, isPending, data: hash } = useWriteContract()

writeContract({
  address: TOKEN_ADDRESS,
  abi: tokenAbi,
  functionName: 'transfer',
  args: [recipient, amount],
})

// After
import { useMutation } from '@dappql/react'

const tx = useMutation(Token.mutation.transfer, 'Transfer')
tx.send(recipient, amount)  // spread args, typed from ABI

tx.isPending            // signing
tx.isLoading            // signing OR mining
tx.confirmation.isSuccess  // receipt confirmed
```

`useMutation` wraps `useWriteContract` + `useWaitForTransactionReceipt` into one typed hook. Adds simulate/estimate helpers, a central `onMutationUpdate` callback for global UX, and typed argument inference.

### Preflight + central UX

```tsx
// Before — each mutation rolls its own toast/analytics
onClick={() => {
  writeContract({ ... }, {
    onSuccess: (hash) => toast.info('Submitted', { hash }),
    onError: (e) => toast.error(e.message),
  })
}}

// After — one provider callback covers every mutation
<DappQLProvider
  simulateMutations
  onMutationUpdate={({ status, transactionName, txHash, error }) => {
    if (status === 'submitted') toast.info(`Submitting ${transactionName}…`)
    if (status === 'signed')    toast.info(`${transactionName} signed`, { txHash })
    if (status === 'success')   toast.success(`${transactionName} confirmed`)
    if (status === 'error')     toast.error(error?.message ?? 'Failed')
  }}
>
```

See [Global transaction UX](/guide/mutations-global) and [Mutations](/guide/mutations).

## Paginated reads

### Reading an on-chain array

```tsx
// Before — manual loop, N separate RPCs
const { data: total } = useReadContract({ ..., functionName: 'totalItems' })
const items = await Promise.all(
  Array.from({ length: Number(total) }, (_, i) =>
    publicClient.readContract({ ..., functionName: 'itemAt', args: [BigInt(i)] })
  )
)

// After — one hook, one multicall
const { data: total } = useContextQuery({ total: Registry.call.totalItems() })
const { data: items } = useIteratorQuery(total, (i) => Registry.call.itemAt(i))
```

See [`useIteratorQuery`](/guide/reads/use-iterator-query).

## Template contracts

Contracts deployed at many addresses (ERC20s, user wallets, Uniswap pools) are first-class in DappQL. Flag them with `isTemplate: true` in config:

```js
contracts: {
  ERC20: { isTemplate: true, abi: erc20Abi },
}
```

Then pass the address at the call site:

```tsx
// Before — pass address to every useReadContract
useReadContract({ address: USDC, abi: erc20Abi, functionName: 'balanceOf', args: [account] })

// After — .at() on the Request
useContextQuery({
  usdc: ERC20.call.balanceOf(account).at(USDC),
  dai:  ERC20.call.balanceOf(account).at(DAI),
})
```

See [Template contracts](/guide/templates).

## What stays wagmi

DappQL doesn't replace wagmi — it layers over it. Keep using wagmi directly for:

- **Wallet connection** — `useAccount`, `useConnect`, `useDisconnect`, connectors, etc.
- **Chain + network** — `useChainId`, `useSwitchChain`, chain configs.
- **Signing messages** — `useSignMessage`, `useSignTypedData`.
- **Balance** — `useBalance` for native ETH (contract balances go through DappQL).
- **Watching** — `useWatchContractEvent`, `useBlock`, etc. (or see [Events](/guide/events) for DappQL's typed event decoding).

DappQL's surface is deliberately narrow: typed contract reads, typed writes, multicall batching, mutation lifecycle. Everything else is wagmi's job.

## When NOT to migrate

If your app:
- Only reads from 1-2 contracts and does nothing else complex, wagmi alone is fine.
- Needs per-read `select` transforms that DappQL doesn't expose — `useReadContract` is more flexible there.
- Is already happy with its `useReadContracts` patterns and no cross-component batching would help.

For everyone else — especially apps with growing contract surface area — the switch pays off fast.

## Gotchas during migration

- **Types from wagmi and DappQL are independent.** Mixing them in the same render (e.g., passing `wagmi`'s `data` into a DappQL-typed prop) needs explicit casts.
- **`watchBlocks` is off by default.** Wagmi's `useReadContract` subscribes to block changes via `watch: true`. DappQL doesn't — turn on `watchBlocks` at the provider if you want parity.
- **`useContextQuery`'s keys are arbitrary.** Name them for what they mean, not the method they came from.
- **Mutation args are spread, not an array.** `tx.send(a, b, c)`, never `tx.send([a, b, c])`.

## Related

- [Getting started](/guide/getting-started) — start from zero.
- [Provider setup](/guide/provider) — wagmi + DappQL provider wiring.
- [`useContextQuery`](/guide/reads/use-context-query) — the hook you'll use most.
- [Mutations](/guide/mutations) — `useWriteContract`'s typed superset.
