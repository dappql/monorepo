# Getting started

DappQL is a thin, typed data layer on top of [wagmi](https://wagmi.sh) and [viem](https://viem.sh). It generates typed contract modules from your ABIs, fuses reads across your component tree into one multicall, tracks mutations end-to-end, and ships an MCP server so AI coding agents get live, typed access to your project.

In three steps you go from zero to a React component that reads four contract methods in a single RPC, with types inferred from the ABIs.

::: tip See it running
Live demo: [todo.dappql.com](https://todo.dappql.com). Click the `< / >` icon in the header to see the annotated DappQL code behind every feature.
:::

## 1. Install

```bash
# React bindings + peer deps
npm install @dappql/react wagmi viem @tanstack/react-query

# The codegen CLI
npm install --save-dev dappql
# or globally
npm install -g dappql
```

Optional, depending on your use case:

| Install | When |
| --- | --- |
| [`@dappql/async`](https://www.npmjs.com/package/@dappql/async) | Scripts, servers, bots, indexers, or anything non-React that talks to contracts. |
| [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) | Expose your project to Claude Code, Cursor, or any MCP client. See [For AI agents](/agents/why-ai-first). |

## 2. Configure your contracts

Create `dapp.config.js` at your project root:

```js
export default {
  // Where generated contract modules go
  targetPath: './src/contracts',

  // Emit ESM-style import paths (set true for modern TS/ESM projects)
  isModule: true,

  contracts: {
    Token: {
      address: '0x...',
      abi: [/* ABI json */],
    },
    ToDo: {
      address: '0x...',
      abi: [/* ABI json */],
    },
  },
}
```

Then generate:

```bash
npx dappql
```

You'll get a typed module per contract plus an `index.ts`. You'll also get an `AGENTS.md` at your project root, a guide for AI coding agents tailored to your actual contracts. See [configuration](/guide/configuration) for the full reference, including SDK generation (`isSdk: true`) and template contracts.

## 3. Wire up the provider

Wrap your app in the three providers DappQL depends on:

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

`watchBlocks` turns on per-block refetch, every read stays reactive as new blocks land. See [Provider setup](/guide/provider) for all options.

## 4. Read from your contracts

```tsx
import { Token, ToDo } from './src/contracts'
import { useContextQuery } from '@dappql/react'

export function Dashboard({ account }: { account: `0x${string}` }) {
  const { data, isLoading } = useContextQuery({
    balance:    Token.call.balanceOf(account),
    symbol:     Token.call.symbol(),
    totalTasks: ToDo.call.totalTasks(),
    openTasks:  ToDo.call.openTasksOf(account),
  })

  if (isLoading) return <Spinner />

  return (
    <p>
      {data.balance.toString()} {data.symbol} · {data.openTasks.toString()} open
    </p>
  )
}
```

Four reads, one multicall. Types on `data` are inferred from the ABI, no casts, no `any`. Run this component alongside another that calls `useContextQuery` and they will share the multicall. That's the key semantic: [`useContextQuery`](/guide/reads/use-context-query) batches *across the whole tree*, not just within one hook.

## 5. Write to your contracts

```tsx
import { ToDo } from './src/contracts'
import { useMutation } from '@dappql/react'

export function AddTaskButton() {
  const mutation = useMutation(ToDo.mutation.addItem, 'Add task')

  return (
    <button
      disabled={mutation.isLoading}
      onClick={() => mutation.send('Buy milk', 0n)}
    >
      {mutation.confirmation.isSuccess ? 'Added' : 'Add'}
    </button>
  )
}
```

`mutation.send(...)` takes spread args (not an array). `mutation.isLoading` covers both signing and mining. `mutation.confirmation` is the full receipt hook. See [`useMutation`](/guide/mutations) for simulate/estimate/onUpdate patterns.

## What you just built

You now have:

- A **React app** with end-to-end typed contract access.
- **Cross-component multicall batching** without any manual work.
- **Mutation lifecycle tracking** with simulate, estimate, and confirmation built in.
- A **generated `AGENTS.md`** at your project root, whenever an AI coding agent opens this repo, it knows how to use DappQL correctly in *your* project.

## What's next

- [Configuration](/guide/configuration), every option in `dapp.config.js`.
- [Provider setup](/guide/provider), `watchBlocks`, `addressResolver`, `onMutationUpdate`, and more.
- [`useContextQuery`](/guide/reads/use-context-query), the read hook you'll use most.
- [Mutations](/guide/mutations), simulate, estimate, wait-for-receipt, global UX.
- [For AI agents](/agents/why-ai-first), MCP server setup, the AGENTS.md story, Claude Code/Cursor integration.
- [Migrating from wagmi](/guide/migrating-from-wagmi), if you already have a wagmi app.
