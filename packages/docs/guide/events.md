# Events

Every contract module DappQL generates ships typed event helpers. You can decode logs you already have, compute topic hashes, and parse receipts — all with the ABI embedded, no hand-rolled topic0 math.

## Generated surface

For a contract with any events in its ABI, the generated module exports:

```ts
import { Token } from './src/contracts'

Token.events            // typed object: { Transfer, Approval, ... }

Token.getEventTopic('Transfer')
// → '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

Token.parseEvents('Transfer', logs)
// → ParsedEvent<'Transfer'>[], typed args
```

These are thin wrappers over viem's `encodeEventTopics` and `parseEventLogs`, but with the ABI baked in so you never pass it manually.

## Typical flow — filter by topic, parse to typed args

```ts
import { createPublicClient, http } from 'viem'
import { base } from 'viem/chains'
import { Token } from './src/contracts'

const client = createPublicClient({ chain: base, transport: http() })

// Filter logs by topic — topic hash comes from the generated helper
const logs = await client.getLogs({
  address: Token.deployAddress,
  topics: [Token.getEventTopic('Transfer')],
  fromBlock: 44_000_000n,
  toBlock: 'latest',
})

// Decode into typed args
const parsed = Token.parseEvents('Transfer', logs)
for (const { event, parsed: [decoded] } of parsed) {
  console.log(decoded.eventName)        // 'Transfer'
  console.log(decoded.args.from, decoded.args.to, decoded.args.value)
  console.log(event.blockNumber)        // raw log data available too
}
```

## Watching live

Wagmi's `useWatchContractEvent` is the React way to subscribe. DappQL doesn't wrap it — use wagmi directly for live event subscriptions:

```tsx
import { useWatchContractEvent } from 'wagmi'
import { Token } from './src/contracts'

useWatchContractEvent({
  address: Token.deployAddress,
  abi: Token.abi,
  eventName: 'Transfer',
  onLogs: (logs) => {
    const parsed = Token.parseEvents('Transfer', logs)
    // ...
  },
})
```

Pass the generated `Token.abi` straight in — it's already typed.

## Via `@dappql/mcp` — `getEvents` tool

For scripts, debugging, or agent workflows, `@dappql/mcp` exposes events via a tool:

```json
{
  "tool": "getEvents",
  "arguments": {
    "contract": "Token",
    "event": "Transfer",
    "fromBlock": "44000000",
    "toBlock": "latest",
    "args": { "from": "0xabc..." },
    "limit": 100
  }
}
```

Returns decoded events with `{ blockNumber, txHash, logIndex, args }`. No topic hashing, no `eth_getLogs` gymnastics. See [Tools reference](/agents/mcp/tools#getevents).

## Decoding an unknown log

If you have a log but don't know which contract emitted it, `@dappql/mcp`'s `getTransaction` tool auto-decodes every log in a receipt against every project contract's ABI — first match wins. Useful for "what did this tx do":

```json
{
  "tool": "getTransaction",
  "arguments": { "hash": "0x..." }
}
```

Response includes `logs: [{ decoded: { contract, eventName, args } | null, ... }]`.

## Event arg types

Indexed args come from topics; non-indexed args come from the log's `data` field. `parseEvents` gives you the union correctly typed:

```ts
// ABI: event Transfer(address indexed from, address indexed to, uint256 value)
decoded.args.from   // `0x${string}` — indexed
decoded.args.to     // `0x${string}` — indexed
decoded.args.value  // bigint — non-indexed
```

## Gotchas

- **`uint256` event args are `bigint`.** Don't compare with `Number()`.
- **Topic filtering only works for indexed args.** `args: { value: 1000n }` on the MCP `getEvents` tool does nothing if `value` is non-indexed.
- **Large block ranges time out.** RPCs cap `eth_getLogs` to ~10k block ranges. For bigger windows, chunk queries or use an indexer. The MCP tool returns `truncated: true` when `total > limit`.
- **Template contracts need an explicit address.** `Token.getEventTopic('Transfer')` works because topic is ABI-only, but `getLogs` needs the address passed in.

## Related

- [`getEvents` MCP tool](/agents/mcp/tools#getevents) — agent-callable event reader.
- [`getTransaction` MCP tool](/agents/mcp/tools#gettransaction) — full tx + auto-decoded logs.
- [Templates](/guide/templates) — event patterns across many instances.
