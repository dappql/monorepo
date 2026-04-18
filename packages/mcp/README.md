# @dappql/mcp

> MCP server that makes a [DappQL](https://github.com/dappql/monorepo) project first-class context for AI coding agents.

`@dappql/mcp` walks up from the current directory, loads your `dapp.config.js`, and exposes your contracts to any [Model Context Protocol](https://modelcontextprotocol.io/) client — Claude Code, Cursor, Codex, and friends — via a small, stable tool + resource surface. Agents can list your contracts, inspect ABIs, run real reads against the chain (batched through multicall), dry-run writes, and — if you explicitly opt in — sign and broadcast transactions.

It never asks the agent to hand-craft ABIs or guess addresses. Everything is derived from your `dapp.config.js` and executed through viem, the same runtime DappQL uses.

## Install

```bash
# Usually invoked via npx in an MCP client config, not installed globally
npx -y @dappql/mcp
```

## Client setup

**Claude Code** — add to `~/.claude.json` (or `.mcp.json` in your project):

```json
{
  "mcpServers": {
    "dappql": {
      "command": "npx",
      "args": ["-y", "@dappql/mcp"],
      "env": {
        "DAPPQL_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

**Cursor** — `~/.cursor/mcp.json` with the same shape.

The server must be launched from (or walk up to) a directory containing `dapp.config.js`. If you invoke it from a subfolder of your project, that's fine — it searches upward.

## Configuration

Everything non-sensitive goes in `dapp.config.js`. Anything secret goes in the env block of your MCP client config.

```js
// dapp.config.js
export default {
  targetPath: './src/contracts',
  chainId: 8453,
  contracts: { /* ... */ },

  mcp: {
    rpc: 'https://mainnet.base.org',  // optional; overrides DAPPQL_RPC_URL
    allowWrites: false,                // must be true AND env key must be set to enable writes
  },
}
```

| Setting | Source | Purpose |
| --- | --- | --- |
| RPC URL | `mcp.rpc` (config) → `DAPPQL_RPC_URL` (env) | Viem transport. Config wins if both are set. |
| Signing key | `DAPPQL_PRIVATE_KEY` or `MNEMONIC` (env only) | Required for `callWrite`. Never put this in `dapp.config.js`. |
| Write permission | `mcp.allowWrites: true` (config) | Second gate — **both** this AND a key must be present for writes to be enabled. |
| Codegen permission | `mcp.allowCodegen: true` (config) | Gates the `regenerate` tool. Default off — MCP doesn't write into your repo unless you opt in. |

## Tools

| Tool | What it does |
| --- | --- |
| `getDappqlReference` | Returns the canonical DappQL library reference as markdown (React hooks, provider options, template/singleton patterns, SDK factory syntax, non-negotiables). **Call this first when asked "what is dappql" or before recommending any DappQL code.** |
| `projectInfo` | Summary: config path, chain, RPC host, contract count, writes/codegen policy. Emits a `hint` + `resources` pointer to the library reference. |
| `chainState` | Live chain state: latest block number, block timestamp (unix + ISO), block hash, gas price. Pair with `callRead`'s `block` argument for historical queries or time-windowed analysis. |
| `listContracts` | Names, shape (singleton/template), deploy addresses, method/event counts. |
| `getContract` | Full metadata for one contract: reads, writes, events, optional raw ABI. |
| `searchMethods` | Ranked search across every method in every contract. Great when the agent knows what it wants to do but not which contract owns it. |
| `callRead` | Execute a single view/pure method. Bigints stringified on the way out. `block` arg for historical reads. |
| `multicall` | Batch multiple reads into one RPC. Per-call errors returned inline. Mirrors `useContextQuery` semantics. |
| `getEvents` | Fetch and decode events for a named contract + event. Topic hashing and argument decoding handled from the ABI. Supports `fromBlock`/`toBlock`/`limit` and indexed-arg filtering. |
| `getTransaction` | Fetch tx + receipt by hash. Returns `gasUsed`, `status`, the decoded input (method + args) when the target is a known contract, and every log auto-decoded against any project contract that emitted it. |
| `simulateWrite` | Dry-run any non-view method via `eth_call`. **No signing key needed** — safe to expose to any agent. Returns decoded result + gas estimate, or revert reason. |
| `callWrite` | Sign and broadcast. **Double-gated**: requires `mcp.allowWrites: true` and a signing key. Always simulates first and aborts on revert. `waitForReceipt: true` blocks until mined. |
| `regenerate` | Re-run codegen against `dapp.config.js` — writes typed contract modules, SDK factory (if `isSdk`), and updates the project `AGENTS.md`. **Gated**: requires `mcp.allowCodegen: true`. Only emits for contracts whose ABI is embedded in the config (contracts relying on Etherscan must use the `dappql` CLI). Supports `dryRun: true`. |

## Resources

| URI | Content |
| --- | --- |
| `dappql://project/AGENTS.md` | The generated agent guide (when present at your project root). |
| `dappql://project/config` | Normalized view of `dapp.config.js`. |
| `dappql://contracts/{Name}` | Per-contract summary + full ABI. |
| `dappql://docs/library` | Canonical DappQL library reference — React hooks, provider options, async runtime, SDK generation, codegen behavior, non-negotiables. Bundled with the server at build time from the monorepo's root `AGENTS.md` — no network dependency. |

## Safety

- Writes are off by default. The double-gate is intentional: you must commit to `allowWrites: true` in code *and* provide a key in env. Either one alone is not enough.
- Every `callWrite` simulates first and aborts on revert. You cannot broadcast a definitely-failing transaction from this server.
- The server logs its writes-enabled state to stderr on startup so you always know what a spawned process can do.
- For any use against production RPCs, keep `allowWrites: false` and use `simulateWrite` only.

## Status

v0.1 — first cut. On the roadmap for v0.2: an `estimateMulticall` tool, watch/subscribe resources for live block state, and a prompts layer for common dApp scaffolding tasks.

## License

MIT
