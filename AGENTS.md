# AGENTS.md — DappQL

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on this repo **or** helping a user build with DappQL in their own project. Skim section 1 always. Jump to section 2 if you're editing this repo, or section 3 if a user is consuming DappQL.

---

## 1. What DappQL is

DappQL is the batteries-included data layer for dApp frontends, built on **wagmi + viem**. It is a *plugin*, not a replacement — if code is using wagmi or viem directly, that's fine; DappQL just adds typed codegen, multicall batching, per-block reactivity, iterator queries, mutation tracking, and optional non-React SDK generation on top.

**Never propose replacing wagmi or viem with DappQL.** They are peer dependencies. DappQL's hooks wrap `useReadContracts` / `useWriteContract` internally.

**Monorepo layout** (pnpm workspaces + turbo):

| Path | Package | Purpose |
| --- | --- | --- |
| `packages/react` | `@dappql/react` | React hooks, provider, query manager |
| `packages/async` | `@dappql/async` | Non-React runtime (`query`, `queryWithStatus`, `singleQuery`, `iteratorQuery`, `mutate`) |
| `packages/codegen` | `@dappql/codegen` | Framework-agnostic codegen — `createContractsCollection`, `createAgentsFile`, shared types. Shared by the CLI and MCP. |
| `packages/cli` | `dappql` | Binary — Etherscan ABI fetching, config loader, invokes `@dappql/codegen` |
| `packages/mcp` | `@dappql/mcp` | MCP server — exposes a user's DappQL project (reads, multicall, simulate, gated writes, gated codegen) to AI coding agents |
| `packages/docs` | VitePress | User-facing docs site |
| `apps/test-app` | — | End-to-end test harness |

---

## 2. Contributing to this repo

**Install & dev**
```bash
pnpm install
pnpm dev            # turbo watch across all packages
pnpm test           # vitest across react + async
pnpm types          # typecheck
pnpm build          # build all packages
```

**Shipping packages** (only when asked by the maintainer):
```bash
pnpm ship:react     # build + bump + publish @dappql/react
pnpm ship:async
pnpm ship:cli
```

**Conventions**
- TypeScript strict mode; no `any` without justification.
- Prefer `Edit` over rewrites. Match surrounding style (Prettier is the formatter).
- Public API additions to `@dappql/react` or `@dappql/async` must:
  1. Ship with tests in the corresponding `tests/` folder (vitest).
  2. Export types alongside runtime values.
  3. Stay framework-agnostic in `@dappql/async` — no React imports.
- Generated-code templates live in `packages/cli/src/templates/`. When editing them, mirror changes in both `isSdk: true` and `isSdk: false` branches; keep the ESM (`isModule: true`) branch working.
- Never hand-edit generated contract files; regenerate with `dappql`.
- Don't modify `dist/` or `lib/` — those are build output.

---

## 3. When a user is building with DappQL

> **First: check the project root for an `AGENTS.md`.** The `dappql` CLI emits a project-specific one that lists the actual contracts, methods, and setup for *that* project. It is authoritative for the current codebase and supersedes anything here if the two disagree about concrete names, paths, or flags. This section is the *general* reference.

This is the *public API surface* an agent should produce. These are the load-bearing patterns — use them verbatim.

### 3.1 Setup (do this once per app)

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DappQLProvider } from '@dappql/react'

<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <DappQLProvider watchBlocks>{children}</DappQLProvider>
  </QueryClientProvider>
</WagmiProvider>
```

- `watchBlocks` enables per-block auto-refetch. Default off.
- `simulateMutations` preflights every tx via `simulateContract`.
- `onMutationUpdate` is the single callback for transaction UX (toasts, analytics, receipts). Status values: `'submitted' | 'signed' | 'success' | 'error'`.
- `addressResolver: (contractName) => Address` resolves contract addresses dynamically; use when the app reads from a registry or proxy.
- `AddressResolverComponent` is the async alternative when the resolver itself needs hooks. **Mutually exclusive with `addressResolver`** — never pass both.

### 3.2 Reads — pick the right hook

Generated code exposes each contract as a namespace. A typed call is built as `ContractName.call.methodName(...args)`.

```ts
import { Token, ToDo } from './contracts'
```

| Hook | Use when |
| --- | --- |
| `useContextQuery` | **Default choice.** Batches calls across the whole component tree into one multicall. |
| `useQuery` | You want a single multicall scoped to one component, or you need per-query options (`blockNumber`, `paused`, custom `refetchInterval`, `batchSize`). |
| `useSingleQuery` / `useSingleContextQuery` | Exactly one call; returns `data` directly instead of an object. |
| `useIteratorQuery` / `useIteratorContextQuery` | Reading an on-chain array / paginated data with a `total` count and `(index) => Request` builder. |

**Prefer `useContextQuery` unless you have a reason not to.** More batching = fewer RPCs.

```tsx
const { data, isLoading } = useContextQuery({
  balance: Token.call.balanceOf(account),
  symbol: Token.call.symbol(),
  totalTasks: ToDo.call.totalTasks(),
})
```

`data` keys match the query object; types come from the ABI — no casts needed.

### 3.3 Fluent request customization

```ts
Token.call.balanceOf(account)
  .at('0x...')       // override deploy address for this call
  .defaultTo(0n)     // default value returned until the query resolves
  .with({ contractAddress, defaultValue })  // both at once
```

### 3.4 Mutations

```tsx
const mutation = useMutation(ToDo.mutation.addItem, 'Add task')

mutation.send('Buy milk', 0n)              // spread args, not array

mutation.isLoading                          // pending OR awaiting receipt
mutation.isPending                          // signing only
mutation.confirmation.isSuccess             // receipt confirmed
mutation.simulate(...args)                  // manual preflight
mutation.estimate(...args)                  // gas estimate
mutation.reset()
```

Second arg is either a transaction-name string or `{ transactionName, address, simulate }`.

### 3.5 Outside React

```ts
import { query, iteratorQuery } from '@dappql/async'
```

Same request shape, pass a viem `PublicClient` explicitly. For a full typed SDK (`createSdk` factory, events, templates), set `isSdk: true` in `dapp.config.js` — see `README.md` for the pattern.

### 3.6 Things agents commonly get wrong — don't

- **bigint, not number.** `uint256` args and returns are `bigint`. Use `0n`, `1n`, `BigInt(x)`. Never `Number(bigintValue)` for display — use `toString()` or viem's `formatUnits`.
- **Address format.** Must be `\`0x${string}\``. Use viem's `getAddress` for checksum normalization if input is untrusted.
- **Don't reach for `useReadContract` / `useReadContracts` / `useWriteContract` directly** when the user has DappQL installed. Use `useContextQuery` / `useQuery` / `useMutation`. The whole point is the batching and typing layer.
- **Don't destructure individual values assuming undefined.** `data.foo` is always defined (populated from `.defaultTo()` or ABI zero-value). Check `isLoading` / `isError` at the top.
- **`mutation.send(...args)` takes spread args**, not an array. `send(a, b, c)`, not `send([a, b, c])`.
- **`useQuery` vs `useContextQuery` is not interchangeable for batching semantics.** `useQuery` batches *within* its own call list only. `useContextQuery` fuses across the tree.
- **Generated files are autogenerated** (`/* @ts-nocheck */` header). Don't edit them. Re-run `dappql` after editing `dapp.config.js`.
- **`@dappql/async` imports must not leak into React components.** Use `@dappql/react` hooks in the browser; `@dappql/async` is for scripts/servers/SDKs.
- **Don't pass both `addressResolver` and `AddressResolverComponent` to the provider** — it throws at runtime.

### 3.7 When unsure, check

- `README.md` — full quickstart, SDK generation, outside-React examples.
- `packages/docs/guide/getting-started.md` — user-facing walkthrough.
- `packages/react/src/*.ts` — canonical signatures if TypeScript autocomplete isn't enough.
- `packages/cli/src/templates/createContractsCollection.ts` — exactly what the CLI emits.

---

## 4. Reporting back to the user

When you produce DappQL code, mention:
1. Whether batching kicks in (and whether `useContextQuery` would batch further).
2. Whether `watchBlocks` is active — users often forget to enable it.
3. Anything that requires `dappql` regeneration (config change, new contract, new ABI method).
