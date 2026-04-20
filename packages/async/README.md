# @dappql/async

> Non-React runtime for [DappQL](https://github.com/dappql/core). Typed contract reads (single, batched, iterator) and writes against viem clients, for scripts, servers, indexers, bots, and generated protocol SDKs.

Same typed contract calls as the React hooks, no React required. Works against any viem `PublicClient` / `WalletClient`.

## Install

```bash
npm install @dappql/async viem
```

Pair with the [`dappql`](https://www.npmjs.com/package/dappql) CLI to generate your typed contract modules.

## Reads

### `query`: one multicall, all-or-nothing

```ts
import { createPublicClient, http } from 'viem'
import { query } from '@dappql/async'
import { Token } from './contracts'

const client = createPublicClient({ transport: http() })

const data = await query(client, {
  supply: Token.call.totalSupply(),
  symbol: Token.call.symbol(),
})
// data: { supply: bigint, symbol: string }
```

Every request is fused into a single multicall. Throws on the first revert, use `queryWithStatus` if you need per-call error granularity.

### `queryWithStatus`: per-call results, never throws

```ts
import { queryWithStatus } from '@dappql/async'

const results = await queryWithStatus(client, {
  a: Token.call.balanceOf(address1),
  b: Token.call.balanceOf(address2),
})

if (results.a.ok) use(results.a.result)
else report(results.a.error)
```

Same batching as `query`; each key resolves to `{ ok: true, result } | { ok: false, error }`. Useful for tools, debug views, and UIs that tolerate partial failures.

### `singleQuery`: single typed read

```ts
import { singleQuery } from '@dappql/async'

const balance = await singleQuery(client, Token.call.balanceOf(owner))
```

### `iteratorQuery`: paginated on-chain arrays

```ts
import { iteratorQuery } from '@dappql/async'

const items = await iteratorQuery(
  client,
  totalCount,
  (index) => Registry.call.itemAt(index),
)
```

## Writes

```ts
import { mutate } from '@dappql/async'
import { Token } from './contracts'

const send = mutate(walletClient, Token.mutation.transfer)
const hash = await send(recipient, 1000n)
```

## Address resolution

Every function accepts an optional `addressResolver` for dynamic deployments (registries, proxies, multi-deploy setups):

```ts
const data = await query(client, requests, { blockNumber }, (contractName) => addresses[contractName])
```

## When to use this vs `@dappql/react`

| Use `@dappql/async` when | Use `@dappql/react` when |
| --- | --- |
| Scripts, cron jobs, indexers, bots | In a React component |
| Node.js servers, edge functions | Provider-wrapped app tree |
| Building a protocol SDK | Need per-block reactivity |
| Anywhere React isn't present | Need cross-component multicall batching |

For shipping a protocol SDK, see [SDK generation](https://github.com/dappql/core#generate-a-full-sdk) in the root docs.

## Related packages

| Package | Purpose |
| --- | --- |
| [`@dappql/react`](https://www.npmjs.com/package/@dappql/react) | React hooks, provider, query manager |
| [`dappql`](https://www.npmjs.com/package/dappql) | Codegen CLI, generates the typed contract modules you import above |
| [`@dappql/codegen`](https://www.npmjs.com/package/@dappql/codegen) | Framework-agnostic codegen engine |
| [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) | MCP server, live contract context for AI coding agents |

## Full documentation

[github.com/dappql/core](https://github.com/dappql/core)

## License

MIT
