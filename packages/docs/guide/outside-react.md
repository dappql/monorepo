# Outside React

The React hooks are one surface; they're not the only one. `@dappql/async` is the framework-agnostic runtime — same generated contract modules, same typed calls, against a viem `PublicClient` or `WalletClient` instead of a provider-tree.

Use it for scripts, servers, bots, cron jobs, indexers, CI checks, and inside published SDKs.

```bash
npm install @dappql/async viem
```

## Reads

### `query` — one multicall, all-or-nothing

```ts
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { query } from '@dappql/async'
import { Token, Registry } from './src/contracts'

const client = createPublicClient({ chain: base, transport: http() })

const data = await query(client, {
  supply:  Token.call.totalSupply(),
  name:    Token.call.name(),
  entries: Registry.call.numEntries(),
})

// data: { supply: bigint, name: string, entries: bigint }
```

Every request fused into a single multicall. Throws on the first revert. Results returned as a plain object keyed exactly like the input.

### `queryWithStatus` — per-call results, never throws

```ts
import { queryWithStatus } from '@dappql/async'

const results = await queryWithStatus(client, {
  a: Token.call.balanceOf(address1),
  b: Token.call.balanceOf(address2),
  c: Token.call.balanceOf(missingAddress), // will revert
})

if (results.a.ok) console.log(results.a.result)
if (!results.c.ok) console.error(results.c.error)
```

Same batching as `query`, same inputs — but each entry resolves to `{ ok: true, result } | { ok: false, error }`. Useful for tools, debug views, indexers that tolerate partial failures, and anything that needs to inspect which calls failed without losing the batch.

### `singleQuery` — single typed read

```ts
import { singleQuery } from '@dappql/async'

const balance = await singleQuery(client, Token.call.balanceOf(owner))
// balance: bigint
```

Thin wrapper over `query` for the common one-call case. Returns the decoded value directly.

### `iteratorQuery` — paginated arrays

```ts
import { iteratorQuery } from '@dappql/async'

const items = await iteratorQuery(
  client,
  totalCount,
  (index) => Registry.call.itemAt(index),
  { firstIndex: 0n },
)

// items: Array<{ value: Inferred, queryIndex: bigint }>
```

Non-React version of [`useIteratorQuery`](/guide/reads/use-iterator-query). Same shape, same batching.

## Writes

```ts
import { createWalletClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { mutate } from '@dappql/async'
import { Token } from './src/contracts'

const walletClient = createWalletClient({
  account: privateKeyToAccount(process.env.PRIVATE_KEY as `0x${string}`),
  chain: base,
  transport: http(),
})

const send = mutate(walletClient, Token.mutation.transfer)
const hash = await send(recipient, 1000n)
```

`mutate` returns a send function with args typed from the ABI — spread args, exactly like `useMutation.send(...)` in React.

For template contracts, pass `address` in the options:

```ts
const send = mutate(walletClient, UserWallet.mutation.deposit, { address: walletAddress })
await send(assetAddress, amount)
```

## Block number pinning

Every read function takes an `options.blockNumber` to pin to a historical block:

```ts
const sevenDaysAgo = currentBlock - 302_400n
const pastData = await query(
  client,
  { supply: Token.call.totalSupply() },
  { blockNumber: sevenDaysAgo },
)
```

Useful for TWAP calculations, historical APR/APY derivation, or "what did this look like a week ago" dashboards.

## Address resolution

Every function accepts an optional `addressResolver` — same shape as the React provider's resolver:

```ts
const addresses: Record<string, `0x${string}`> = {
  Token:    '0x...',
  Registry: '0x...',
}

const data = await query(
  client,
  { supply: Token.call.totalSupply() },
  {},
  (contractName) => addresses[contractName],
)
```

For published SDKs, the class usually holds both the addresses and a resolver. See the [Underscore pattern](/guide/sdk-generation) for a full example.

## When to use this vs React hooks

| Use `@dappql/async` when | Use `@dappql/react` when |
| --- | --- |
| Script, cron job, indexer, bot | Inside a React component |
| Node.js server, edge function | Provider-wrapped app tree |
| Building a publishable protocol SDK | Need per-block reactivity |
| CI check that diffs on-chain state | Need cross-component multicall batching |
| Anywhere React isn't loaded | Need centralized mutation UX |

Inside a React app, **always prefer the hooks**. You lose auto-refetch, tree-wide batching, and mutation lifecycle tracking if you reach for `query` from a component.

## Real-world use cases

**CI check — address registry hasn't drifted:**

```ts
import { query } from '@dappql/async'
import { UndyHq } from './contracts'

const { ledger, missionControl } = await query(client, {
  ledger: UndyHq.call.getAddr(1n),
  missionControl: UndyHq.call.getAddr(2n),
})

assert.equal(ledger, EXPECTED_LEDGER_ADDRESS)
assert.equal(missionControl, EXPECTED_MISSION_CONTROL_ADDRESS)
```

**Indexer — backfill ERC20 balances across a cohort:**

```ts
import { iteratorQuery } from '@dappql/async'
import { ERC20 } from './contracts'

const balances = await iteratorQuery(
  client,
  BigInt(holders.length),
  (i) => ERC20.call.balanceOf(holders[Number(i)]).at(USDC),
)
```

**Publishable SDK** — wrap `createSdk` in a class and expose typed helpers. See [SDK generation](/guide/sdk-generation).

## Related

- [SDK generation](/guide/sdk-generation) — `createSdk` factory, protocol-library pattern.
- [`useContextQuery`](/guide/reads/use-context-query) — the React equivalent of `query`.
- [Mutations](/guide/mutations) — the React equivalent of `mutate`.
