# @dappql/react

> React hooks for [DappQL](https://github.com/dappql/monorepo). Typed, batched smart-contract reads and writes on top of [wagmi](https://wagmi.sh) + [viem](https://viem.sh) — with automatic multicall fusion across your entire component tree, per-block reactivity, iterator queries, and mutation tracking.

## Install

```bash
npm install @dappql/react wagmi viem @tanstack/react-query
```

Pair with the [`dappql`](https://www.npmjs.com/package/dappql) CLI to generate your typed contract modules.

## Provider

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DappQLProvider } from '@dappql/react'

const queryClient = new QueryClient()

export function Root({ children }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <DappQLProvider watchBlocks>{children}</DappQLProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

Provider options:

| Option | Purpose |
| --- | --- |
| `watchBlocks` | Refetch on every new block — makes reads reactive to chain state. |
| `simulateMutations` | Preflight every tx via `eth_call`. Aborts on revert. |
| `onMutationUpdate` | Single callback for every transaction lifecycle event — one place to drive toasts, analytics, receipts. |
| `addressResolver` | Function that resolves contract names to addresses — for registries, proxies, multi-deploy. |
| `AddressResolverComponent` | Async alternative to `addressResolver` when the resolver needs hooks. |

## Reads

### `useContextQuery` — the default

Batches calls across your **entire** component tree into one multicall.

```tsx
import { Token, ToDo } from './contracts'
import { useContextQuery } from '@dappql/react'

function Dashboard({ account }) {
  const { data, isLoading } = useContextQuery({
    balance: Token.call.balanceOf(account),
    symbol: Token.call.symbol(),
    totalTasks: ToDo.call.totalTasks(),
  })

  if (isLoading) return <Spinner />
  return <p>{data.balance.toString()} {data.symbol}</p>
}
```

If `<Dashboard>` and `<Sidebar>` both use `useContextQuery`, their calls fuse into one RPC — not two.

### `useQuery` — component-scoped batching

Same shape as `useContextQuery`, but scoped to this hook call. Use when you need `blockNumber`, `paused`, custom `refetchInterval`, or `batchSize` overrides.

### `useSingleQuery` / `useSingleContextQuery`

```tsx
const { data } = useSingleContextQuery(Token.call.balanceOf(account))
// data: bigint (inferred from the ABI)
```

### `useIteratorQuery` — on-chain arrays

```tsx
import { useIteratorQuery } from '@dappql/react'

const { data } = useIteratorQuery(totalTasks, (i) => ToDo.call.taskAt(account, i))
```

## Writes

```tsx
import { useMutation } from '@dappql/react'
import { ToDo } from './contracts'

function NewTask() {
  const mutation = useMutation(ToDo.mutation.addItem, 'Add task')

  return (
    <button
      disabled={mutation.isLoading}
      onClick={() => mutation.send('Buy milk', 0n)}
    >
      {mutation.confirmation.isSuccess ? 'Added' : 'Add task'}
    </button>
  )
}
```

Surface:

```ts
mutation.send(...args)              // broadcast; spread args, not array
mutation.simulate(...args)          // manual preflight
mutation.estimate(...args)          // gas estimate
mutation.isPending                  // awaiting signature
mutation.isLoading                  // awaiting signature OR mining
mutation.confirmation.isSuccess     // receipt confirmed
mutation.reset()
```

## Fluent request API

Every generated call exposes a small fluent API for overrides:

```ts
Token.call.balanceOf(account)
  .at('0x...')       // override deploy address
  .defaultTo(0n)     // default value until the call resolves
```

## Related packages

| Package | Purpose |
| --- | --- |
| [`dappql`](https://www.npmjs.com/package/dappql) | Codegen CLI — generates the typed contract modules you import above |
| [`@dappql/async`](https://www.npmjs.com/package/@dappql/async) | Non-React runtime — same typed calls, no React required |
| [`@dappql/codegen`](https://www.npmjs.com/package/@dappql/codegen) | Framework-agnostic codegen engine |
| [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) | MCP server — live contract context for AI coding agents |

## Full documentation

[github.com/dappql/monorepo](https://github.com/dappql/monorepo)

## License

MIT
