# useContextQuery

`useContextQuery` is the read hook you should reach for first. Same shape as [`useQuery`](/guide/reads/use-query), but its batching scope is the **whole component tree**, not just the current hook.

Three components on the same screen each calling `useContextQuery`? They fuse into one multicall RPC. Add a fourth component deep in a tab panel? Still one multicall. This is the primary reason DappQL exists.

## Basic usage

```tsx
import { Token, ToDo } from './src/contracts'
import { useContextQuery } from '@dappql/react'

function Dashboard({ account }: { account: `0x${string}` }) {
  const { data, isLoading, isError, error } = useContextQuery({
    balance:    Token.call.balanceOf(account),
    symbol:     Token.call.symbol(),
    totalTasks: ToDo.call.totalTasks(),
  })

  if (isLoading) return <Spinner />
  return <p>{data.balance.toString()} {data.symbol}</p>
}
```

The shape of `data` matches the query object's keys. Each value's type is inferred from the ABI, TypeScript catches typos, wrong arg types, and accidental use of a method that doesn't exist.

## Cross-component batching

Here's the superpower:

```tsx
function Header({ account }) {
  const { data } = useContextQuery({
    balance: Token.call.balanceOf(account),
    symbol:  Token.call.symbol(),
  })
  return <span>{data.balance.toString()} {data.symbol}</span>
}

function Footer() {
  const { data } = useContextQuery({
    totalSupply: Token.call.totalSupply(),
  })
  return <small>Total: {data.totalSupply.toString()}</small>
}

function App() {
  return (
    <DappQLProvider>
      <Header account="0x..." />
      <MainContent />
      <Footer />
    </DappQLProvider>
  )
}
```

Despite being in completely separate subtrees, `Header`, `MainContent`, and `Footer` all share a single multicall. The provider runs a small query manager that collects every outstanding `useContextQuery` request, fires one multicall per refetch cycle, and distributes the results back.

This means you can colocate data fetching with the components that need it, no lifting queries up, no prop-drilling, no "single source of truth" ceremony.

## When to use `useQuery` instead

Reach for [`useQuery`](/guide/reads/use-query) when you need **per-query options** that don't make sense at the shared-batch level:

- `blockNumber`, pin this query to a specific historical block.
- `paused`, skip fetching until a condition is met.
- `refetchInterval`, custom polling for this query only.
- `batchSize`, custom multicall chunk size.

Otherwise: default to `useContextQuery`.

## Fluent request API

Each `Contract.call.method(args)` returns a typed Request. You can chain overrides on the Request, not on the contract namespace:

```ts
// ✅ Override deploy address for this specific call
Token.call.balanceOf(account).at('0x2222...')

// ✅ Default value shown until the query resolves
Token.call.balanceOf(account).defaultTo(0n)

// ✅ Both at once
Token.call.balanceOf(account).with({ contractAddress: '0x...', defaultValue: 0n })

// ❌ .at() is NOT on the namespace, this does not exist
Token.at('0x2222...').call.balanceOf(account)
```

See [Fluent request API](/guide/reads/fluent-api) for the full reference.

## Template contracts

For contracts deployed at many addresses (user wallets, ERC20 tokens, vaults), you **must** pass an address via `.at()`:

```tsx
import { UserWallet, ERC20 } from './src/contracts'

const { data } = useContextQuery({
  owner:    UserWallet.call.owner().at(walletAddress),
  balance:  ERC20.call.balanceOf(holder).at(tokenAddress),
  symbol:   ERC20.call.symbol().at(tokenAddress),
})
```

See [Template contracts](/guide/templates) for more patterns.

## Return shape

```ts
const {
  data,       // { [key]: inferred from ABI }, always populated (defaults + real values)
  isLoading,  // first fetch in flight
  isError,
  error,      // wagmi/viem error, null on success
  refetch,    // force a refetch
} = useContextQuery({ ... })
```

`data` is **always populated**, never `undefined`. Before the first successful fetch, each key holds the `defaultValue` you set via `.defaultTo()`, or the ABI's zero-value (`0n` for `uint256`, `''` for `string`, etc.). This means you don't have to null-check individual values in your render, check `isLoading` at the top if you want a spinner, then treat `data` as fully present.

## Reactivity

If you enabled `watchBlocks` on the provider, every `useContextQuery` refetches on every new block (or every N blocks, see `blocksRefetchInterval`). Turn it off for expensive queries by passing `isStatic: true`:

```tsx
const { data } = useContextQuery(
  { totalSupply: Token.call.totalSupply() },
  { isStatic: true }, // never re-fetch; assume value doesn't change
)
```

## Tips

- **Key your query object semantically.** The keys become your `data.foo` names, name them for what they mean, not the method they came from.
- **Don't compose a `useContextQuery` from hook return values.** The query object shape needs to be stable across renders; if you rebuild it each render the manager can't dedupe. Use `useMemo` if your args are derived.
- **Zero-arg methods use `()`, even though the generated types allow it without.** `Token.call.symbol()` is correct.
- **Bigints are bigints.** Never pass `Number(someBigint)`, formatting should happen in the render layer via viem's `formatUnits` / `formatEther`.

## Related

- [`useQuery`](/guide/reads/use-query), when you need per-query options.
- [`useIteratorQuery`](/guide/reads/use-iterator-query), for paginated on-chain arrays.
- [Fluent request API](/guide/reads/fluent-api), `.at()`, `.defaultTo()`, `.with()`.
- [Per-block reactivity](/guide/per-block-reactivity), `watchBlocks` in depth.
