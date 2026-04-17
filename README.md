<p align="center">
  <img src="./logo-dappql.svg" width="220" alt="DappQL" />
</p>

<p align="center">
  <b>The batteries-included data layer for dApp frontends.</b><br/>
  Built on top of <a href="https://wagmi.sh">wagmi</a> + <a href="https://viem.sh">viem</a>. Designed for humans and AI agents.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@dappql/react"><img src="https://img.shields.io/npm/v/@dappql/react.svg?label=%40dappql%2Freact" alt="npm @dappql/react" /></a>
  <a href="https://www.npmjs.com/package/dappql"><img src="https://img.shields.io/npm/v/dappql.svg?label=dappql%20cli" alt="npm dappql" /></a>
  <img src="https://img.shields.io/npm/l/@dappql/react.svg" alt="license" />
</p>

---

## Why DappQL

Wagmi gives you great primitives. DappQL is the productivity layer you reach for once your dApp talks to more than a handful of contracts.

- **Typed codegen from your ABIs.** Point it at your contracts, get a fully typed SDK. When an ABI changes, TypeScript tells you exactly what broke.
- **Automatic multicall batching** across a component *and* across your whole app — calls from unrelated components get fused into one RPC.
- **Per-block reactivity** out of the box. Your UI stays in sync with chain state without hand-rolled subscriptions.
- **Iterator queries** for on-chain arrays and paginated data.
- **Mutations with simulate, estimate, and confirmation tracking** — and a single callback for global transaction UX.
- **Address resolver** for registries, proxies, or multi-deployment setups.
- **Works outside React too.** `@dappql/async` gives you the same typed calls in scripts, servers, and bots — or flip one flag and the CLI generates a publishable typed SDK for your whole protocol.
- **AI-agent friendly.** The generated SDK, predictable APIs, and strict types mean Claude, Cursor, and friends produce working code on the first try.

DappQL doesn't replace wagmi or viem — it stands on top of them. If you know wagmi, you already know most of DappQL.

## Install

```bash
# The React bindings
npm install @dappql/react wagmi viem @tanstack/react-query

# The codegen CLI
npm install -g dappql
```

## Configure

Create `dapp.config.js` at the root of your project:

```js
export default {
  targetPath: './src/contracts',
  contracts: {
    Token: {
      address: '0x...',
      abi: [/* ... */],
    },
    ToDo: {
      address: '0x...',
      abi: [/* ... */],
    },
  },
}
```

Then generate:

```bash
dappql
```

You get one typed module per contract plus an index — ready to import.

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

## Query

```tsx
import { useQuery } from '@dappql/react'
import { Token, ToDo } from './contracts'

function Dashboard({ account }) {
  const { data, isLoading } = useQuery({
    balance: Token.call.balanceOf(account),
    symbol: Token.call.symbol(),
    totalTasks: ToDo.call.totalTasks(),
    userTasks: ToDo.call.totalUserTasks(account),
  })

  if (isLoading) return <Spinner />

  return (
    <div>
      <p>{data.balance.toString()} {data.symbol}</p>
      <p>{data.userTasks.toString()} / {data.totalTasks.toString()} tasks</p>
    </div>
  )
}
```

All four reads land in a single multicall. Types on `data` are inferred from the ABIs — no casts, no `any`.

## Cross-component batching

`useContextQuery` has the same shape but batches *across your entire component tree*. Three components each asking for different data ship one RPC instead of three.

```tsx
import { useContextQuery } from '@dappql/react'

const { data } = useContextQuery({
  balance: Token.call.balanceOf(account),
})
```

## Iterator queries

For on-chain arrays and paginated reads:

```tsx
import { useIteratorQuery } from '@dappql/react'

const { data } = useIteratorQuery(
  totalTasks,
  (i) => ToDo.call.taskAt(account, i),
)
```

## Mutations

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

Pass `simulateMutations` at the provider to preflight every transaction, or `onMutationUpdate` for a single place to drive toasts, analytics, and receipts.

## Fluent request API

Every generated call exposes a small fluent API for the cases where you need to override defaults:

```ts
Token.call.balanceOf(account)
  .at('0x...')            // override the deploy address
  .defaultTo(0n)           // default value until the call resolves
```

## Outside React

DappQL has a fully typed non-React runtime. Two flavors, same generated code underneath.

### Ad-hoc multicalls with `@dappql/async`

For scripts, servers, bots, and indexers that just need to read or write on demand:

```ts
import { createPublicClient, http } from 'viem'
import { query } from '@dappql/async'
import { Token } from './contracts'

const client = createPublicClient({ transport: http() })

const { data } = await query(client, {
  supply: Token.call.totalSupply(),
  symbol: Token.call.symbol(),
})
```

Same requests, same types — no React required.

### Generate a full SDK

Flip `isSdk: true` in `dapp.config.js` and the CLI emits a `createSdk(publicClient, walletClient, addressResolver)` factory alongside the typed modules. This is how you'd ship an npm-publishable SDK for your protocol.

```js
// dapp.config.js
export default {
  targetPath: './src/contracts',
  chainId: 8453,
  isModule: true,
  isSdk: true,
  contracts: {
    Factory: { address: '0x...', abi: [/* ... */] },
    Token:   { address: '0x...', abi: [/* ... */] },
    // Contracts deployed at many addresses (user wallets, vaults, etc.):
    UserWallet: { isTemplate: true, abi: [/* ... */] },
    ERC20:      { isTemplate: true, abi: [/* ... */] },
  },
}
```

```ts
import { createPublicClient, http, WalletClient } from 'viem'
import { base } from 'viem/chains'

import createSdk from './contracts/sdk'

const publicClient = createPublicClient({ chain: base, transport: http() })

const sdk = createSdk(publicClient, walletClient)

// Singleton contracts — address baked in from the config
const supply = await sdk.Token.totalSupply()
const newWallet = await sdk.Factory.createUserWallet(owner, agent)

// Template contracts — pass the address per call
const erc20 = sdk.ERC20('0x...')
const balance = await erc20.balanceOf(holder)

// Events, fully typed
const topic = sdk.Token.events.Transfer.topic
const parsed = sdk.Token.events.Transfer.parse(logs)
```

Wrap it in your own class for extras — dynamic address resolution, custom helpers, chain config:

```ts
import { query, RequestCollection, GetItemCallFunction, iteratorQuery } from '@dappql/async'
import * as CONTRACTS from './contracts'
import createSdk, { SDK } from './contracts/sdk'

export default class MyProtocol {
  publicClient: PublicClient
  walletClient: WalletClient | undefined
  contracts: SDK
  addresses: Partial<Record<keyof typeof CONTRACTS, Address>> = {}

  constructor(config?: { publicClient?: PublicClient; walletClient?: WalletClient }) {
    this.publicClient = config?.publicClient ?? createPublicClient({ chain: base, transport: http() })
    this.walletClient = config?.walletClient
    this.contracts = createSdk(this.publicClient, this.walletClient, this.addressResolver)
  }

  addressResolver = (name: string) => this.addresses[name as keyof typeof CONTRACTS]!

  // Expose the multicall builder with full autocomplete on `contracts`
  multicall<T extends RequestCollection>(
    build: (contracts: typeof CONTRACTS) => T,
    options: { blockNumber?: bigint } = {},
  ) {
    return query(this.publicClient, build(CONTRACTS), options, this.addressResolver)
  }

  iterate<T>(
    build: (contracts: typeof CONTRACTS) => { total: bigint; getItem: GetItemCallFunction<T> },
    options: { blockNumber?: bigint; firstIndex?: bigint } = {},
  ) {
    const { total, getItem } = build(CONTRACTS)
    return iteratorQuery(this.publicClient, total, getItem, options, this.addressResolver)
  }
}
```

Consumers get a tight API with end-to-end types:

```ts
const protocol = new MyProtocol()

const { data } = await protocol.multicall((c) => ({
  totalSupply: c.Token.call.totalSupply(),
  balance:     c.Token.call.balanceOf(user),
  price:       c.Oracle.call.getPrice(asset),
}))
```

> See [Underscore Finance's SDK](https://github.com/underscore-finance/typescript-sdk) for a production example — a full protocol SDK generated from hundreds of ABIs with DappQL.

## Packages

| Package | Version | Description |
| --- | --- | --- |
| [`@dappql/react`](./packages/react) | [![npm](https://img.shields.io/npm/v/@dappql/react.svg)](https://www.npmjs.com/package/@dappql/react) | React hooks, provider, and query manager |
| [`@dappql/async`](./packages/async) | [![npm](https://img.shields.io/npm/v/@dappql/async.svg)](https://www.npmjs.com/package/@dappql/async) | Non-React query + mutation runtime |
| [`dappql`](./packages/cli) | [![npm](https://img.shields.io/npm/v/dappql.svg)](https://www.npmjs.com/package/dappql) | Codegen CLI |

## Documentation

Full docs live in [`packages/docs`](./packages/docs). Run them locally with `pnpm docs:dev`.

## Contributing

PRs and issues are welcome. For anything larger than a small fix, please open an issue first so we can align on direction.

## License

MIT
