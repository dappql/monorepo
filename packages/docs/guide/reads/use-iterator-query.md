# useIteratorQuery

Paginate on-chain arrays with a single hook. Give it a total count and a function that builds a request for each index; it does the rest — one multicall for all items, deterministic batching, bigint-safe indexing.

## Basic usage

```tsx
import { ToDo } from './src/contracts'
import { useContextQuery, useIteratorQuery } from '@dappql/react'

function TaskList({ account }: { account: `0x${string}` }) {
  // Get the total count first
  const { data: counts } = useContextQuery({
    total: ToDo.call.totalTasks(),
  })

  // Then iterate
  const { data: tasks } = useIteratorQuery(
    counts.total,
    (i) => ToDo.call.taskAt(account, i),
  )

  return (
    <ul>
      {tasks.map(({ value, queryIndex }) => (
        <li key={queryIndex.toString()}>{value.content}</li>
      ))}
    </ul>
  )
}
```

## Signature

```ts
const { data, isLoading, isError } = useIteratorQuery(
  total,                                    // bigint — the count to iterate
  (index: bigint) => Contract.call.at(index), // one Request per index
  options,                                  // same as useQuery + `firstIndex`
)

// data: Array<{ value: inferred, queryIndex: bigint }>
```

### Parameters

| Parameter | Type | Purpose |
| --- | --- | --- |
| `total` | `bigint` | How many items to fetch. Usually comes from another `useContextQuery` read (`totalTasks`, `numWallets`, etc.). |
| `getItem` | `(i: bigint) => Request` | Called `total` times — each returns a typed Request. |
| `options` | `QueryOptions & { firstIndex?: bigint }` | Per-query options (same as [`useQuery`](/guide/reads/use-query)) plus `firstIndex` for offset-based pagination. |

### Return

An array where each entry is `{ value, queryIndex }`:

- `value` — the decoded return value, typed from the ABI.
- `queryIndex` — the index this entry was fetched at (as `bigint`).

## Pagination with `firstIndex`

For "load more" patterns, pass `firstIndex` to skip the first N entries:

```tsx
const [page, setPage] = useState(0n)
const PAGE_SIZE = 20n

const { data } = useIteratorQuery(
  PAGE_SIZE,
  (i) => Registry.call.entryAt(i),
  { firstIndex: page * PAGE_SIZE },
)

// Page 0: indexes 0–19
// Page 1: indexes 20–39
// etc.
```

For "last N" patterns, compute the offset from the total:

```tsx
const { data: counts } = useContextQuery({ total: Registry.call.numEntries() })
const { data: recent } = useIteratorQuery(
  10n,
  (i) => Registry.call.entryAt(i),
  { firstIndex: counts.total > 10n ? counts.total - 10n : 0n },
)
```

## Batching

All `total` requests go into a single multicall. A 1,000-item iterator = one RPC. If that exceeds your multicall batch size, increase `batchSize` on the provider or per-query.

```tsx
const { data } = useIteratorQuery(
  1000n,
  (i) => Token.call.balanceOf(holders[i]),
  { batchSize: 2048 },
)
```

## Cross-component flavor — `useIteratorContextQuery`

`useIteratorContextQuery` is the context-batched variant: the iterator fuses with every other `useContextQuery` in the app tree.

```tsx
import { useIteratorContextQuery } from '@dappql/react'

const { data } = useIteratorContextQuery(total, (i) => Registry.call.entryAt(i))
```

Same signature minus the per-query options. Prefer this when there's no reason to isolate the iterator from the global batch.

## Iterating over templates

For [template contracts](/guide/templates), `.at()` binds the instance address inside the getter:

```tsx
const { data: wallets } = useIteratorContextQuery(
  totalWallets,
  (i) => UserWallet.call.balance().at(walletAddresses[Number(i)]),
)
```

## Empty arrays

When `total === 0n`, the hook returns an empty array without issuing an RPC:

```ts
useIteratorQuery(0n, fn).data // []
```

Useful as a degenerate case — no special-casing needed in render.

## Gotchas

- `total` is a **bigint**. Don't pass a plain number.
- `queryIndex` in the return is also bigint. Convert with `Number()` only when the index is guaranteed to fit.
- `getItem` runs `total` times — don't let it do expensive work per call. Pre-compute anything outside.
- Every Request produced by `getItem` **must** be for the same return type. TypeScript will infer from the first one.

## Related

- [`useContextQuery`](/guide/reads/use-context-query) — fetch the total count first.
- [Fluent request API](/guide/reads/fluent-api) — `.at()` inside the getter for templates.
- [`useQuery`](/guide/reads/use-query) — for single-scope batching options.
