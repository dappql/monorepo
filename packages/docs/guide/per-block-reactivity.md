# Per-block reactivity

Chain state changes every block. DappQL can keep every `useContextQuery` / `useQuery` in your app in sync automatically — opt in with one flag, and reads refetch as new blocks land.

## Turning it on

```tsx
import { DappQLProvider } from '@dappql/react'

<DappQLProvider watchBlocks>
  {children}
</DappQLProvider>
```

That's it. Every query that doesn't opt out refetches on every new block. No per-component subscription wiring.

## How it works

Under the hood:

1. The provider subscribes to wagmi's block-number watcher once, at the root.
2. On every new block, the internal query manager triggers a refetch across every active `useContextQuery` and `useQuery` hook — **batched into one multicall**.
3. Data flows back to components; React re-renders what actually changed.

One block → one multicall → every view updated. No fan-out, no per-hook polling, no cascading re-renders.

## Tuning the refetch interval

If per-block is too aggressive, refetch every N blocks:

```tsx
<DappQLProvider watchBlocks blocksRefetchInterval={5}>
  {/* ~10s on Ethereum, ~10s on Base, ~1s on Arbitrum */}
</DappQLProvider>
```

`blocksRefetchInterval` defaults to 1 (every block). Set it to `10` on a fast chain (Arbitrum, Base) if you don't need sub-2s freshness.

## Per-query opt-out

For queries where chain freshness doesn't matter — chain-static values like `decimals`, `name`, `symbol`, `owner` on immutable contracts — flag them `isStatic`:

```tsx
const { data } = useQuery(
  { symbol: Token.call.symbol(), decimals: Token.call.decimals() },
  { isStatic: true },
)
```

Static queries fetch once and stay. They don't participate in block-driven refetches, which saves RPC calls without any correctness cost.

For `useContextQuery`, there's no per-query `isStatic` — by design, since the whole point of context batching is grouping. If you need a mix of static and live reads, split them: static ones via `useQuery({ ... }, { isStatic: true })`, live ones via `useContextQuery({ ... })`.

## Per-query custom interval

Need faster refresh on a specific hook? Override `blocksRefetchInterval` per `useQuery`:

```tsx
const { data: price } = useQuery(
  { price: Oracle.call.getPrice(asset) },
  { blocksRefetchInterval: 1 },
)

const { data: slowMetrics } = useQuery(
  { tvl: Registry.call.getTVL() },
  { blocksRefetchInterval: 100 },  // every ~3.3min on Base
)
```

## Pausing

Need to disable refetch temporarily (a modal is open, a form is being edited, etc.)? Use `paused`:

```tsx
const { data } = useQuery(
  { balance: Token.call.balanceOf(account) },
  { paused: isEditing },
)
```

Paused queries don't fetch at all — no initial load, no refetch. Toggle `paused: false` to resume. Paired with `defaultTo()` this gives you a stable fallback for the paused window.

## Pinning to a block

Historical queries bypass the watcher entirely — they resolve once at the specified block and don't refetch:

```tsx
const { data } = useQuery(
  { supply: Token.call.totalSupply() },
  { blockNumber: 44_500_000n },
)
```

Useful for TWAP calculations, "as of last snapshot" dashboards, or auditing.

## Performance notes

- **One multicall per refetch cycle.** Scales linearly with contract count, not hook count. A page with 100 `useContextQuery` calls pulling 300 reads total → 1 RPC per block, not 300.
- **`notifyOnChangeProps: ['data', 'error']`.** DappQL tells TanStack Query to only re-render when these change. `isFetching` toggling between refetches doesn't re-render the tree.
- **Default `batchSize` is 1024.** If your batch exceeds this, multicalls chunk automatically.
- **RPC rate limits apply.** Alchemy/Infura/QuickNode free tiers typically handle per-block refetch without throttling for moderate traffic. Paid tiers lift the ceiling further.

## When to turn off `watchBlocks`

- **Server-rendered pages** that don't need live updates. Use `@dappql/async`'s `query` for SSR data, `watchBlocks` for hydrated client state (or skip it if stale-on-load is fine).
- **Heavily static views** (about pages, deploy addresses, immutable token metadata) — if the whole view is static, leave `watchBlocks` off at the provider and let wagmi handle any dynamic state you still need.
- **RPC-budget-conscious deployments** — per-block refetch burns RPC credits. Increase `blocksRefetchInterval` or turn off globally, with per-query `watchBlocks: true` overrides on the few reads that need live freshness.

## Interaction with mutations

Mutations do NOT trigger per-block refetches — they trigger a refetch after the transaction confirms. If you need a read to refresh on a mutation, it'll happen automatically via the next block-driven refetch with `watchBlocks` on, or you can call `refetch()` manually from the query result.

## Related

- [Provider setup](/guide/provider) — `watchBlocks`, `blocksRefetchInterval` options.
- [`useContextQuery`](/guide/reads/use-context-query) — the primary reactive hook.
- [`useQuery`](/guide/reads/use-query) — per-query options (`isStatic`, `paused`, `blockNumber`).
