# Tools reference

`@dappql/mcp` exposes 13 tools. Agents call them over stdio via the Model Context Protocol. This page describes each one, purpose, inputs, outputs, with example invocations so you can debug sessions.

For setup, see [MCP setup](/agents/mcp/setup). For the resources surface, see [Resources](/agents/mcp/resources).

---

## Discovery & metadata

### `getDappqlReference`

Returns the canonical DappQL library reference as markdown. Covers React hooks, provider options, template vs singleton patterns, SDK factory syntax, and the non-negotiables.

**Agents should call this first** when asked about DappQL or before recommending any DappQL code.

**Input:** none

**Output:**
```json
{ "format": "markdown", "bundled": true, "content": "# AGENTS.md, DappQL\n..." }
```

`bundled: false` means the package's shipped asset is missing, the handler falls back to a pointer to the GitHub source.

### `projectInfo`

Summary of the current DappQL project. What chain, what RPC, how many contracts, what safety gates are open.

**Input:** none

**Output:**
```json
{
  "configPath": "/Users/you/myapp/dap.config.js",
  "root": "/Users/you/myapp",
  "chainId": 8453,
  "rpcHost": "mainnet.base.org",
  "contractCount": 12,
  "targetPath": "./src/contracts",
  "isSdk": true,
  "writesEnabled": false,
  "writesPolicy": "writes disabled: not opted in...",
  "codegenEnabled": false,
  "codegenPolicy": "codegen disabled: mcp.allowCodegen: true missing...",
  "resources": { "libraryReference": { "uri": "dappql://docs/library", ... }, ... },
  "hint": "Before writing or recommending DappQL code, read the library-reference resource..."
}
```

The `hint` + `resources` fields steer agents toward the library reference on turn one.

### `chainState`

Live chain state. Current block number, block timestamp (unix + ISO), block hash, gas price.

Pair with `callRead`'s `block` argument for historical queries or time-windowed analysis.

**Input:** none

**Output:**
```json
{
  "chainId": 8453,
  "blockNumber": "44834573",
  "blockHash": "0xaaa...",
  "blockTimestamp": "1744902900",
  "blockTimestampISO": "2026-04-17T17:15:00.000Z",
  "gasPrice": "1500000000"
}
```

---

## Contract discovery

### `listContracts`

Every contract in the project with shape (singleton | template), deploy address (if any), and method/event counts.

**Input:** none

**Output:** `{ chainId, contracts: [{ name, shape, address, readCount, writeCount, eventCount }, ...], hint }`

### `getContract`

Full metadata for a single contract: reads, writes, events, optional raw ABI.

**Input:**
```json
{ "name": "Token", "includeAbi": false }
```

**Output:** `ContractSummary` with per-method signatures. Set `includeAbi: true` to include the raw ABI array.

### `searchMethods`

Ranked search across every method in every contract. Scores by substring match and token overlap.

**Input:**
```json
{ "query": "balance", "kind": "read", "limit": 20 }
```

`kind` is `"read" | "write" | "any"` (default). Useful when an agent knows what it wants to do but not which contract owns the method.

**Output:** `{ query, total, results: [{ contract, kind, method, inputs, outputs, score }, ...] }`

---

## Chain reads

### `callRead`

Execute a single view/pure method. Decoded result with bigints stringified.

**Input:**
```json
{
  "contract": "Token",
  "method": "balanceOf",
  "args": ["0xabc..."],
  "block": "44500000"
}
```

- `address`, override deploy address (required for templates).
- `block`, pin to a historical block (decimal or 0x-hex).

**Output:** `{ contract, method, address, result }`

### `multicall`

Batch multiple reads into a single RPC. Mirrors `useContextQuery` semantics. Per-call errors returned inline instead of throwing.

**Input:**
```json
{
  "calls": [
    { "key": "supply",  "contract": "Token",  "method": "totalSupply" },
    { "key": "balance", "contract": "Token",  "method": "balanceOf", "args": ["0xabc..."] },
    { "key": "owner",   "contract": "UserWallet", "method": "owner", "address": "0xdef..." }
  ],
  "block": "44500000"
}
```

**Output:** `{ results: [{ key, contract, method, address, ok, result | error }, ...] }`

Each call reports `ok: true` with decoded `result`, or `ok: false` with an `error` string. Use this instead of `callRead` whenever there are multiple reads.

### `getEvents`

Fetch and decode events emitted by a contract within a block range. Topic hashing + argument decoding handled from the ABI.

**Input:**
```json
{
  "contract": "Token",
  "event": "Transfer",
  "fromBlock": "44000000",
  "toBlock": "latest",
  "limit": 100,
  "args": { "from": "0xabc..." }
}
```

- `address`, override deploy address (required for templates).
- `fromBlock` / `toBlock`, numeric or tags (`"earliest" | "latest" | "pending" | "safe" | "finalized"`). Defaults: `"earliest"` → `"latest"`.
- `args`, filter by **indexed** event args only.

**Output:** `{ total, returned, truncated, events: [{ blockNumber, txHash, logIndex, args }, ...] }`

### `getTransaction`

Fetch a tx + receipt by hash. Returns gasUsed, status, decoded input, and every log decoded against any project contract that emitted it.

**Input:** `{ "hash": "0x..." }`

**Output:** full tx + receipt with:

- `gasUsed`, `status`, `blockNumber`, `from`, `to`, `value`, `gasPrice`, `effectiveGasPrice`
- `decodedInput: { contract, method, args } | null`, present when `tx.to` matches a known project contract.
- `logs: [{ address, logIndex, topics, data, decoded: { contract, eventName, args } | null }, ...]`, each log attempted against every project ABI; first decode wins.

Use this to answer "how much gas did this tx burn" + "what did it actually do" in one call.

---

## Chain writes

### `simulateWrite`

Dry-run any non-view method via `eth_call`. **No signing key required.** Safe on any RPC, including production.

Returns the decoded simulated return value and gas estimate on success, or the revert reason on failure.

**Input:**
```json
{
  "contract": "Token",
  "method": "transfer",
  "args": ["0xabc...", "1000000"],
  "from": "0xsender...",
  "value": "0"
}
```

`from` defaults to the zero address, usually fails with "insufficient balance." Pass a real address to get meaningful simulation.

**Output (success):** `{ ok: true, contract, method, address, from, result, gas }`

**Output (revert):** `{ ok: false, contract, method, address, from, error }`

### `callWrite`

Sign and broadcast a contract write. **Double-gated**: requires both `mcp.allowWrites: true` in `dap.config.js` AND a signing key (`DAPPQL_PRIVATE_KEY` or `MNEMONIC`) in env. Either alone is not enough.

Always simulates first and aborts on revert. Never broadcasts a failing transaction.

**Input:**
```json
{
  "contract": "Token",
  "method": "transfer",
  "args": ["0xabc...", "1000000"],
  "value": "0",
  "waitForReceipt": false
}
```

- `address`, override deploy address (required for templates).
- `value`, ETH value in wei for payable methods.
- `waitForReceipt`, if true, blocks until the tx is mined and returns the receipt.

**Output (broadcast):**
```json
{ "ok": true, "contract", "method", "address", "hash": "0x...", "note": "..." }
```

**Output (waited):** same plus `receipt: { ... }`.

See [Safety model](/agents/mcp/safety).

---

## Codegen

### `regenerate`

Re-run DappQL codegen against the project's `dap.config.js`. Writes typed contract modules, `sdk.ts` (if `isSdk`), and updates the project `AGENTS.md`.

**Gated**: requires `mcp.allowCodegen: true` in `dap.config.js` (default off). Also requires ABIs to be embedded in the config, contracts that rely on Etherscan fetching must go through the `dappql` CLI.

**Input:** `{ "dryRun": false }`

`dryRun: true` reports what would be written without touching the filesystem.

**Output (live run):**
```json
{
  "ok": true,
  "regenerated": ["Token", "ToDo"],
  "skippedMissingAbi": [],
  "targetPath": "./src/contracts",
  "agents": { "path": "/.../AGENTS.md", "mode": "updated" }
}
```

---

## Tool ordering

The server registers tools in this order, which most clients surface in `tools/list`:

1. `getDappqlReference` (first for discoverability)
2. `projectInfo`
3. `chainState`
4. `listContracts`
5. `getContract`
6. `searchMethods`
7. `callRead`
8. `multicall`
9. `getEvents`
10. `getTransaction`
11. `simulateWrite`
12. `callWrite`
13. `regenerate`

Agents that scan tool names top-down see the library-reference tool immediately.

## Related

- [MCP setup](/agents/mcp/setup), client configuration.
- [Resources](/agents/mcp/resources), the docs + config + per-contract resources.
- [Safety model](/agents/mcp/safety), how writes and codegen gates compose.
- [Underscore case study](/agents/case-studies/underscore), sessions using these tools.
