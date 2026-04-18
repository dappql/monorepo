# For AI agents

DappQL is the only Web3 data layer designed from the ground up around AI coding agents as first-class users. Every project ships with two things that make agents — Claude Code, Cursor, Codex, any MCP client — produce correct code on the first try against your contracts:

1. A **generated `AGENTS.md`** at your project root, tailored to your actual contracts. Agents read it on project load.
2. A **live MCP server** (`@dappql/mcp`) that walks up to your `dapp.config.js` and exposes your contracts as typed tools: list, inspect, read, simulate, and — with explicit opt-in — write.

This page explains why those exist, what problem they solve, and what the agent workflow looks like end-to-end.

## The problem without them

An agent coding against smart contracts is like a human dev without a REPL. It pattern-matches from training data, guesses at function signatures, confuses `uint256` for `number`, puts `.at()` in the wrong place, calls methods that don't exist. The result is plausible code that doesn't compile, or compiles and reverts at runtime.

The underlying issue isn't agent capability — it's feedback loop. Until now, the loop has been: **agent guesses → developer tests → developer corrects → repeat**. That's slow and brittle.

DappQL closes the loop directly. The agent can:

- **List** every contract in the project and see shape, addresses, method/event counts.
- **Inspect** any contract's full ABI.
- **Search** across all methods by name or concept.
- **Run** real reads against the live chain to verify assumptions (units, return shapes, edge cases).
- **Simulate** writes with `eth_call` from a user's address — no signing needed — to confirm a transaction would succeed before committing code.
- **Read** canonical DappQL library docs without leaving the MCP surface.

All typed. All zero-friction. Agents that ignore this and guess produce wrong code. Agents that use it produce correct code.

## The two layers

### 1. Generated `AGENTS.md` — project-specific context

Every `dappql` run writes (or updates) an `AGENTS.md` at your project root. It contains:

- A table of every contract you declared — name, shape (singleton or template), reads, writes, events.
- Usage examples with **your actual contract names and real method signatures** (so agents can copy-paste valid code).
- ABI-accurate argument placeholders (`tx.send(/* to, amount */)`) — no guessing at param names.
- Non-negotiables: bigint for uint256, spread args on `send`, `.at()` on the Request not the namespace, etc.

Updates are **marker-scoped** — the CLI only rewrites content between `<!-- dappql:start -->` and `<!-- dappql:end -->`, so any hand-written instructions above or below are preserved. See [Generated AGENTS.md](/agents/generated-agents-md) for the full schema.

Every major coding agent — Claude Code, Cursor, OpenAI Codex, Copilot with `.github/copilot-instructions.md`, Aider — reads `AGENTS.md` (or a similar convention) on project load. You don't opt in; it just works.

### 2. `@dappql/mcp` — live chain context

The [Model Context Protocol](https://modelcontextprotocol.io) is the emerging standard for connecting AI assistants to external tools. `@dappql/mcp` is an MCP server that turns your DappQL project into a set of agent-callable tools and resources.

```json
// ~/.claude.json or .mcp.json
{
  "mcpServers": {
    "dappql": {
      "command": "npx",
      "args": ["-y", "@dappql/mcp"],
      "env": { "DAPPQL_RPC_URL": "https://mainnet.base.org" }
    }
  }
}
```

Restart the client. The agent now has **13 tools** and **4 resources** scoped to your project:

| Tool | Purpose |
| --- | --- |
| `getDappqlReference` | Returns the canonical DappQL library reference. Agents call this first when asked about DappQL. |
| `projectInfo` | Config path, chain, RPC host, contract count, writes/codegen policy. |
| `chainState` | Live block number, timestamp, gas price. |
| `listContracts` | Every contract with shape, address, method/event counts. |
| `getContract` | Full ABI for one contract. |
| `searchMethods` | Fuzzy search across every method in every contract. |
| `callRead` | Execute a view method, returns typed decoded result. |
| `multicall` | Batch reads — mirrors `useContextQuery` semantics. |
| `getEvents` | Decode and filter events for a contract within a block range. |
| `getTransaction` | Full tx + receipt, with decoded input and logs. |
| `simulateWrite` | Dry-run any write. No signing key needed. |
| `callWrite` | Sign + broadcast. **Double-gated**: requires config opt-in + env key. |
| `regenerate` | Run codegen against `dapp.config.js`. Gated. |

See [Tools reference](/agents/mcp/tools) for full signatures.

## Real session — what this looks like

Here's a verbatim session with Claude Code connected to `@underscore-finance/sdk` (a dappql-generated SDK covering 75 contracts on Base):

**User:** *"how much USDC do I get if I withdraw one UndyUsd?"*

The agent called `dappql` three times:
1. `searchMethods("preview")` — found `previewRedeem` on UndyUsd.
2. `getContract({ name: "UndyUsd" })` — verified it's an ERC4626 share-to-asset method.
3. `callRead({ contract: "UndyUsd", method: "previewRedeem", args: ["1000000"] })` — 1 UndyUsd = 1e6 base units (6 decimals).

**Response:** *"Redeeming 1 UndyUsd ≈ 1.021804 USDC (current ratio from `UndyUsd.previewRedeem(1e6)` → 1,021,804 USDC base units; both tokens have 6 decimals; underlying asset is USDC `0x8335...2913`)."*

Four reasoning steps, three RPC round-trips, one sentence of output. That's a complete DeFi math answer any library *without* typed context simply cannot deliver.

For a deeper walk-through including a write-simulation safety catch and APY derivation from historical blocks, see the [Underscore case study](/agents/case-studies/underscore).

## Safety

Writes are the blast zone. DappQL's MCP gate enforces **double opt-in** — you need both:

1. `mcp.allowWrites: true` in `dapp.config.js`
2. `DAPPQL_PRIVATE_KEY` (or `MNEMONIC`) in the MCP server's env block

Either alone is not enough. Every `callWrite` also simulates first and aborts on revert, so you cannot broadcast a definitely-failing transaction from the MCP server.

Codegen is similarly gated via `mcp.allowCodegen: true`. By default the agent cannot modify files in your repo.

`simulateWrite` needs **no** signing key — it's a pure `eth_call` dry-run, always safe to expose.

See [Safety model](/agents/mcp/safety) for the full gating logic.

## Next

- [Generated AGENTS.md](/agents/generated-agents-md) — schema, config, marker-scoped updates.
- [MCP setup](/agents/mcp/setup) — Claude Code, Cursor, and any MCP client.
- [Tools reference](/agents/mcp/tools) — signatures + usage patterns.
- [Case studies](/agents/case-studies/underscore) — real agent sessions.
