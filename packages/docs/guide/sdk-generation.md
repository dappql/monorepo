# SDK generation

Set `isSdk: true` in `dapp.config.js` and DappQL emits a full, publishable typed SDK alongside the per-contract modules. This is how protocols ship their frontend primitives, one npm package your whole team and ecosystem imports.

```js
export default {
  targetPath: './src/contracts',
  isModule: true,
  isSdk: true,            // ← the flag
  chainId: 8453,
  contracts: { /* ... */ },
}
```

Re-run `dappql`. You'll now get a `sdk.ts` in your target path with a `createSdk(publicClient, walletClient, addressResolver?)` factory that composes every contract into one typed object.

## What's generated

`src/contracts/sdk.ts` exports:

```ts
export type SDK = {
  Token:      Token.SDK                     // singleton
  Factory:    Factory.SDK
  UserWallet: (address: Address) => UserWallet.SDK  // template, function call
  ERC20:      (address: Address) => ERC20.SDK
  // ...
}

export default function createSdk(
  publicClient?: PublicClient,
  walletClient?: WalletClient,
  addressResolver?: AddressResolverFunction,
): SDK
```

Singleton contracts become properties; template contracts (flagged with `isTemplate: true`) become **function calls** returning a bound instance. Events are exposed under `sdk.Contract.events.EventName.{ topic, parse }`.

## Using the SDK

```ts
import { createPublicClient, http, createWalletClient } from 'viem'
import { base } from 'viem/chains'
import createSdk from './src/contracts/sdk'

const publicClient = createPublicClient({ chain: base, transport: http() })
const walletClient = createWalletClient({ account, chain: base, transport: http() })

const sdk = createSdk(publicClient, walletClient)

// Singleton read, address baked in from config
const supply = await sdk.Token.totalSupply()

// Singleton write, returns tx hash
const hash = await sdk.Token.transfer(recipient, 1000n)

// Template, bind the instance address via function call
const userWallet = sdk.UserWallet('0x...')
const owner = await userWallet.owner()
const balance = await userWallet.balanceOf(asset)

// Events
const topic = sdk.Token.events.Transfer.topic
const parsed = sdk.Token.events.Transfer.parse(logs)
```

Every method returns a Promise of the decoded return value (reads) or the tx hash (writes). Bigints are bigints. Addresses are ``\`0x${string}\`` literals.

## Template contracts are function-calls

The most common agent and human mistake: templates in the SDK factory are **not** chained with `.at()`. They're function calls:

```ts
// ✅ Correct
const wallet = sdk.UserWallet(walletAddress)
await wallet.owner()

// ❌ Wrong, .at() is the React/async pattern, not the SDK pattern
sdk.UserWallet.at(walletAddress).owner()

// ❌ Wrong, there's no .write sub-namespace
sdk.UserWallet(walletAddress).write.deposit(...)
```

The SDK factory is deliberately flatter than the React hooks surface, reads and writes live side-by-side on the same object, and templates are parameterized at bind time.

## Wrapping the SDK in a class

A publishable SDK typically wraps `createSdk` in a class that adds protocol-specific helpers (address resolution from an on-chain registry, swap builders, multi-step flows). [Underscore Finance](https://github.com/underscore-finance/typescript-sdk) ships exactly this pattern:

```ts
import {
  query, iteratorQuery, type RequestCollection, type GetItemCallFunction,
  type AddressResolverFunction,
} from '@dappql/async'
import { createPublicClient, http, type PublicClient, type WalletClient, type Address } from 'viem'
import { base } from 'viem/chains'

import * as CONTRACTS from './contracts'
import createSdk, { type SDK } from './contracts/sdk'

export default class Underscore {
  publicClient: PublicClient
  walletClient: WalletClient | undefined
  contracts: SDK
  addresses: Partial<Record<keyof typeof CONTRACTS, Address>> = {}

  constructor(config?: { publicClient?: PublicClient; walletClient?: WalletClient }) {
    this.publicClient = config?.publicClient ?? createPublicClient({ chain: base, transport: http() })
    this.walletClient = config?.walletClient
    this.contracts = createSdk(this.publicClient, this.walletClient, this.addressResolver)
  }

  addressResolver: AddressResolverFunction = (name) =>
    this.addresses[name as keyof typeof CONTRACTS]!

  async loadAddresses() {
    // Resolve singletons via an on-chain registry (UndyHq.getAddr)
    const resolved = await query(this.publicClient, {
      Ledger: CONTRACTS.UndyHq.call.getAddr(1n),
      MissionControl: CONTRACTS.UndyHq.call.getAddr(2n),
      // ...
    })
    this.addresses = { ...this.addresses, ...resolved }
  }

  // Expose a multicall builder with full autocomplete on `contracts`
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
const protocol = new Underscore()
await protocol.loadAddresses()

const { data } = await protocol.multicall((c) => ({
  totalSupply: c.Token.call.totalSupply(),
  balance:     c.Token.call.balanceOf(user),
  price:       c.Oracle.call.getPrice(asset),
}))
```

This is the pattern `@underscore-finance/sdk` ships, go read [its `src/index.ts`](https://github.com/underscore-finance/typescript-sdk/blob/main/src/index.ts) for a full production example.

## Frontends on top of an SDK

A React frontend built on a published DappQL SDK uses **both** the SDK (for contract namespaces + registry-backed address resolution) **and** `@dappql/react` (for hooks). The bridge is `DappQLProvider`'s `addressResolver`:

```tsx
import Underscore from '@underscore-finance/sdk'
import { DappQLProvider } from '@dappql/react'

const underscore = new Underscore()
await underscore.loadAddresses()

<DappQLProvider watchBlocks addressResolver={underscore.addressResolver}>
  {children}
</DappQLProvider>
```

Then inside components, use the SDK's exported contract namespaces with the hooks, not the imperative `sdk.X.method()` calls:

```tsx
import { Ledger, UndyUsd } from '@underscore-finance/sdk'
import { useContextQuery } from '@dappql/react'

const { data } = useContextQuery({
  wallets: Ledger.call.getNumUserWallets(),
  supply:  UndyUsd.call.totalSupply(),
})
```

You get all the React benefits, cross-component batching, per-block reactivity, mutation lifecycle, on top of the SDK's address resolution.

## When to ship an SDK vs plain contracts

| Ship an SDK (`isSdk: true`) | Ship plain contracts |
| --- | --- |
| You're publishing a protocol library for external consumers. | You're building an app that only you consume. |
| Non-React use cases matter (scripts, bots, CI tests). | React is the only target. |
| You have registry-backed address resolution. | All addresses are static in config. |
| You want events + multicall exposed as library primitives. | You're calling contracts directly from hooks. |

For most dApp frontends: start without `isSdk`. Flip it on when you find yourself copy-pasting `createSdk`-style boilerplate or shipping a separate npm package.

## Shipping it as an npm package

Once the SDK is working, `dappql pack` turns it into a self-contained, publishable npm package that both humans and AI agents consume. See [Publishing as a plugin](/guide/publishing).

## Related

- [Publishing as a plugin](/guide/publishing), the `dappql pack` command and the manifest format.
- [Configuration](/guide/configuration), `isSdk`, `isTemplate`, `isModule` flags.
- [Template contracts](/guide/templates), why templates are function-calls in SDK mode.
- [Outside React](/guide/outside-react), `@dappql/async` under the hood.
- [Provider setup](/guide/provider), wiring an SDK's `addressResolver` into React.
