# AGENTS.md: DappQL

Instructions for AI coding agents (Claude Code, Cursor, Copilot, etc.) working on this repo **or** helping a user build with DappQL in their own project. Skim section 1 always. Jump to section 2 if you're editing this repo, or section 3 if a user is consuming DappQL.

---

## 1. What DappQL is

DappQL makes smart contracts fluent for humans and agents. It's an agent-native data layer on **wagmi + viem**, a *plugin*, not a replacement. If code is using wagmi or viem directly, that's fine; DappQL just adds typed codegen, multicall batching, per-block reactivity, iterator queries, mutation tracking, and optional non-React SDK generation on top.

**Never propose replacing wagmi or viem with DappQL.** They are peer dependencies. DappQL's hooks wrap `useReadContracts` / `useWriteContract` internally.

**Monorepo layout** (pnpm workspaces + turbo):

| Path | Package | Purpose |
| --- | --- | --- |
| `packages/react` | `@dappql/react` | React hooks, provider, query manager |
| `packages/async` | `@dappql/async` | Non-React runtime (`query`, `queryWithStatus`, `singleQuery`, `iteratorQuery`, `mutate`) |
| `packages/codegen` | `@dappql/codegen` | Framework-agnostic codegen, `createContractsCollection`, `createAgentsFile`, shared types. Shared by the CLI and MCP. |
| `packages/cli` | `dappql` | Binary, Etherscan ABI fetching, config loader, invokes `@dappql/codegen` |
| `packages/mcp` | `@dappql/mcp` | MCP server, exposes a user's DappQL project (reads, multicall, simulate, gated writes, gated codegen) to AI coding agents |
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
  3. Stay framework-agnostic in `@dappql/async`, no React imports.
- Generated-code templates live in `packages/cli/src/templates/`. When editing them, mirror changes in both `isSdk: true` and `isSdk: false` branches; keep the ESM (`isModule: true`) branch working.
- Never hand-edit generated contract files; regenerate with `dappql`.
- Don't modify `dist/` or `lib/`, those are build output.

---

## 3. When a user is building with DappQL

> **First: check the project root for an `AGENTS.md`.** The `dappql` CLI emits a project-specific one that lists the actual contracts, methods, and setup for *that* project. It is authoritative for the current codebase and supersedes anything here if the two disagree about concrete names, paths, or flags. This section is the *general* reference.

This is the *public API surface* an agent should produce. These are the load-bearing patterns, use them verbatim.

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
- `AddressResolverComponent` is the async alternative when the resolver itself needs hooks. **Mutually exclusive with `addressResolver`**, never pass both.

### 3.2 Reads: pick the right hook

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

`data` keys match the query object; types come from the ABI, no casts needed.

### 3.3 Fluent request customization

`.at()`, `.defaultTo()`, and `.with()` live on the **Request object**, which is returned by `Contract.call.method(args)`. They are NOT methods on the contract namespace itself.

```ts
// ✅ Correct, method first, then fluent-chain
Token.call.balanceOf(account).at('0x...')
Token.call.balanceOf(account).defaultTo(0n)
Token.call.balanceOf(account).with({ contractAddress, defaultValue })

// ❌ Wrong, Token.at() does not exist
Token.at('0x...').call.balanceOf(account)

// ❌ Wrong, there is no `.write` sub-namespace
Token.at('0x...').write.transfer(...)
```

For **template contracts** (deployed at many addresses), `.at(address)` is required, the generated code has no `deployAddress` baked in. For singletons, `.at()` is only an override.

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

Same request shape as the React hooks, just pass a viem `PublicClient` explicitly.

When `isSdk: true` is set in `dapp.config.js`, the CLI also emits a `createSdk(publicClient, walletClient, addressResolver)` factory. The SDK's public shape:

```ts
import createSdk from './contracts/sdk'

const sdk = createSdk(publicClient, walletClient)

// Singleton contract, address baked in from config
const supply = await sdk.Token.totalSupply()
const hash = await sdk.Token.transfer(recipient, 1000n)

// Template contract, address is a FUNCTION ARGUMENT, not .at()
const bound = sdk.UserWallet('0x...')       // ✅ correct
const owner = await bound.owner()
await bound.someMethod(...args)

// ❌ Wrong, SDK templates are not chained with .at()
sdk.UserWallet.at('0x...').method(...)

// ❌ Wrong, there is no .write sub-namespace on the SDK
sdk.UserWallet('0x...').write.method(...)

// Events
const topic = sdk.Token.events.Transfer.topic
const parsed = sdk.Token.events.Transfer.parse(logs)
```

**Key difference between React-hooks world and SDK-factory world:**

| Context | Template instance syntax |
| --- | --- |
| React hooks / `@dappql/async` | `Contract.call.method(args).at(address)`, chain on the Request |
| SDK factory (`isSdk: true`) | `sdk.Contract(address).method(args)`, call the namespace as a function |

### 3.6 Frontend consuming a published DappQL SDK (the common case)

A published DappQL-generated SDK (e.g. `@underscore-finance/sdk`) re-exports its generated contract namespaces at the package root. A React frontend consumes **both** the SDK (for contract modules + address resolution) **and** `@dappql/react` (for hooks). You do NOT reimplement hooks on top of the SDK, and you do NOT use the SDK's imperative `multicall` from inside components, you use `useContextQuery`, which batches across the whole tree.

The bridge is `DappQLProvider`'s `addressResolver`. The SDK's class (e.g. `Underscore`) exposes an `addressResolver` method after `loadAddresses()` resolves on-chain. Pass it to the provider and every `useContextQuery` call auto-resolves singletons correctly:

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DappQLProvider } from '@dappql/react'
import Underscore from '@underscore-finance/sdk'

const underscore = new Underscore()
await underscore.loadAddresses()   // one-time address resolution from a registry

<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <DappQLProvider watchBlocks addressResolver={underscore.addressResolver}>
      {children}
    </DappQLProvider>
  </QueryClientProvider>
</WagmiProvider>
```

Reads, mutations, iterators, templates, use the hooks with the SDK's exported namespaces:

```tsx
import { Ledger, UndyUsd, LootDistributor, UserWallet } from '@underscore-finance/sdk'
import { useContextQuery, useMutation, useIteratorQuery } from '@dappql/react'

// Reads, batched across tree, address resolved via provider
const { data } = useContextQuery({
  wallets: Ledger.call.getNumUserWallets(),
  supply:  UndyUsd.call.totalSupply(),
  pending: LootDistributor.call.getPendingRewards(account),
})

// Template reads, .at() on the Request
const { data } = useContextQuery({
  owner: UserWallet.call.owner().at(walletAddress),
})

// Singleton write
const claim = useMutation(LootDistributor.mutation.claim, 'Claim rewards')
claim.send()

// Template write, pass `address` in options
const deposit = useMutation(UserWallet.mutation.deposit, { address: walletAddress })
deposit.send(assetAddr, amount)

// Iterator
const { data: total } = useContextQuery({ total: Ledger.call.getNumUserWallets() })
const { data: wallets } = useIteratorQuery(total ?? 0n, (i) => Ledger.call.getUserWalletAtIndex(i))
```

For anything imperative (swap instruction builders, off-chain helpers), use the SDK class directly, those aren't contract calls:

```ts
const swap = await underscore.getSwapInstructionsAmountOut({ ... })
```

**Don't:**
- Don't recommend `underscore.multicall((c) => ...)` inside React components, use `useContextQuery`. The SDK's imperative multicall is for scripts/servers.
- Don't confabulate contract names. If you're unsure what exists, call `listContracts` via MCP or check the SDK's exports.

### 3.7 Things agents commonly get wrong, don't

- **bigint, not number.** `uint256` args and returns are `bigint`. Use `0n`, `1n`, `BigInt(x)`. Never `Number(bigintValue)` for display, use `toString()` or viem's `formatUnits`.
- **Address format.** Must be `\`0x${string}\``. Use viem's `getAddress` for checksum normalization if input is untrusted.
- **Don't reach for `useReadContract` / `useReadContracts` / `useWriteContract` directly** when the user has DappQL installed. Use `useContextQuery` / `useQuery` / `useMutation`. The whole point is the batching and typing layer.
- **Don't destructure individual values assuming undefined.** `data.foo` is always defined (populated from `.defaultTo()` or ABI zero-value). Check `isLoading` / `isError` at the top.
- **`mutation.send(...args)` takes spread args**, not an array. `send(a, b, c)`, not `send([a, b, c])`.
- **`useQuery` vs `useContextQuery` is not interchangeable for batching semantics.** `useQuery` batches *within* its own call list only. `useContextQuery` fuses across the tree.
- **Generated files are autogenerated** (`/* @ts-nocheck */` header). Don't edit them. Re-run `dappql` after editing `dapp.config.js`.
- **`@dappql/async` imports must not leak into React components.** Use `@dappql/react` hooks in the browser; `@dappql/async` is for scripts/servers/SDKs.
- **Don't pass both `addressResolver` and `AddressResolverComponent` to the provider**, it throws at runtime.
- **`.at()` lives on the Request, not the namespace.** `Token.call.balanceOf(account).at(addr)`, not `Token.at(addr).call.balanceOf(account)`, not `Token.at(addr).write.transfer(...)`. There is no `.write` sub-namespace anywhere.
- **SDK templates are function calls, not chained.** `sdk.UserWallet('0x...').method(...)`, not `sdk.UserWallet.at('0x...').method(...)`.
- **Don't reach for the SDK's imperative `multicall` inside React components.** Use `useContextQuery`, it batches across the whole tree. The imperative SDK path is for scripts, servers, and non-React runtimes.
- **Don't confabulate contract names.** If you don't know what's in a project, call `listContracts` (via MCP) or read the project's `AGENTS.md`, don't guess at names like `WalletRegistry` that may not exist.

### 3.8 When unsure, check

- `README.md`, full quickstart, SDK generation, outside-React examples.
- `packages/docs/guide/getting-started.md`, user-facing walkthrough.
- `packages/react/src/*.ts`, canonical signatures if TypeScript autocomplete isn't enough.
- `packages/cli/src/templates/createContractsCollection.ts`, exactly what the CLI emits.

---

## 4. Reporting back to the user

When you produce DappQL code, mention:
1. Whether batching kicks in (and whether `useContextQuery` would batch further).
2. Whether `watchBlocks` is active, users often forget to enable it.
3. Anything that requires `dappql` regeneration (config change, new contract, new ABI method).
