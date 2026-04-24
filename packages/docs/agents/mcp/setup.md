# MCP server setup

`@dappql/mcp` is a Model Context Protocol server that turns your DappQL project into a live, typed set of agent-callable tools and resources. Any MCP-aware client, Claude Code, Cursor, Codex, Continue, Zed, can connect to it and get first-class access to your contracts.

This page shows how to wire it up. For why it exists, see [Why AI-first](/agents/why-ai-first).

## Prerequisites

- **Either** a project with a `dap.config.js` (see [Getting started](/guide/getting-started)), **or** a workspace that installs one or more DappQL-packaged SDKs (e.g. `@underscore-finance/sdk`). In the second case, the server runs in [plugin-only mode](#plugin-only-mode) — no local config required.
- An MCP-aware client.
- An RPC URL for your chain.

You do **not** need to install `@dappql/mcp` globally, `npx` pulls it on demand.

## Claude Code

Add the server to `~/.claude.json` (global) or `.mcp.json` at your project root (per-project):

```json
{
  "mcpServers": {
    "dappql": {
      "command": "npx",
      "args": ["-y", "@dappql/mcp"],
      "env": {
        "DAPPQL_DEFAULT_RPC_URL": "https://mainnet.base.org"
      }
    }
  }
}
```

Restart Claude Code. In a new chat, the agent now has 13 dappql tools and 4 resources scoped to your project.

Quick sanity check, ask: *"what contracts are in this project?"*, the agent should call `projectInfo` and `listContracts`.

> `DAPPQL_DEFAULT_RPC_URL` is the **committed** default — safe to put a public RPC here. For a personal Alchemy/QuickNode key, use `DAPPQL_RPC_URL` in a local `.env` (auto-loaded, `.gitignore`'d). It overrides the default. See [RPC config](#rpc-configuration) below.

## Cursor

Add the same block to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "dappql": {
      "command": "npx",
      "args": ["-y", "@dappql/mcp"],
      "env": { "DAPPQL_DEFAULT_RPC_URL": "https://mainnet.base.org" }
    }
  }
}
```

Reload Cursor. MCP servers are listed under settings → MCP.

## Other clients

Any client that speaks the MCP stdio transport will work with the same invocation (`npx -y @dappql/mcp`). The server discovers `dap.config.js` by walking up from its launch directory, so **launch it from inside your project** (or a subdirectory of it).

## Plugin-only mode

If you're an agent user who just wants to *consume* a published DappQL SDK (not build one), you don't need a `dap.config.js`. Create a folder with:

```
my-workspace/
├── .mcp.json
└── package.json    # installs @dappql/mcp + @some-protocol/sdk
```

```json
// package.json
{
  "dependencies": {
    "@dappql/mcp": "^0.2.0",
    "@underscore-finance/sdk": "^1.2.19"
  }
}
```

`npm install`, then open the folder in Claude Code. The server detects no `dap.config.js`, switches to plugin-only mode, and exposes every contract from every DappQL-packaged SDK in `node_modules` via their manifests.

Canonical live example: [`underscore-finance/mcp`](https://github.com/underscore-finance/mcp).

## Configuration

Everything non-sensitive goes in `dap.config.js`. Secrets (signing keys, personal RPC URLs) go in a local `.env` (auto-loaded) or the env block of your MCP client config, never in the repo.

```js
// dap.config.js
export default {
  // ... your contracts, targetPath, etc.

  mcp: {
    rpc: 'https://mainnet.base.org',  // optional, highest-priority RPC source
    allowWrites: false,               // default false, flip to true for callWrite
    allowCodegen: false,              // default false, flip to true for regenerate
  },
}
```

| Setting | Source | Purpose |
| --- | --- | --- |
| RPC URL | `mcp.rpc` → `DAPPQL_RPC_URL` → `DAPPQL_DEFAULT_RPC_URL` | viem transport. See [RPC configuration](#rpc-configuration) for precedence. |
| Signing key | `DAPPQL_PRIVATE_KEY` **or** `MNEMONIC` env | Required for `callWrite`. |
| Write permission | `mcp.allowWrites: true` in config | Second gate. Both this AND a key must be present. |
| Codegen permission | `mcp.allowCodegen: true` in config | Gates the `regenerate` tool. |

See [Safety model](/agents/mcp/safety) for the full gating logic.

## RPC configuration

The MCP server picks an RPC URL in this order, first hit wins:

1. **`mcp.rpc`** in `dap.config.js` — explicit override in code.
2. **`DAPPQL_RPC_URL`** env — the **local** value. Meant for `.env` or shell. Your personal Alchemy / QuickNode / private node URL.
3. **`DAPPQL_DEFAULT_RPC_URL`** env — the **committed** default. Meant for the `env` block in `.mcp.json` / `~/.claude.json`. Safe for public RPCs.

### Using `.env`

`@dappql/mcp` auto-loads `.env` from the launch directory (Node ≥20.12). Drop one next to your project:

```
DAPPQL_RPC_URL=https://base-mainnet.g.alchemy.com/v2/YOUR_KEY
DAPPQL_PRIVATE_KEY=0x...      # optional, only if writes are enabled
```

Gitignore `.env`. Your teammates each keep their own; the committed `DAPPQL_DEFAULT_RPC_URL` is the fallback for anyone who doesn't have one.

## Boot log

On startup, the server logs its state to stderr so you can verify everything loaded correctly:

```
[@dappql/mcp] Project: /Users/you/myapp/dap.config.js
[@dappql/mcp] Chain: 8453
[@dappql/mcp] Contracts: 12
[@dappql/mcp] Writes: disabled, writes disabled: not opted in and no signing key available
[@dappql/mcp] Codegen: disabled, codegen disabled: `mcp.allowCodegen: true` missing from dapp.config.js
```

If you see `No dapp.config.js found walking up from cwd`, the server was launched from outside your project tree.

## Enabling writes (carefully)

Writes require **both** a signing key in env AND an explicit config opt-in. Either alone doesn't unlock `callWrite`. Both together still don't skip simulation, every write is preflighted via `eth_call` and aborts on revert.

```js
// dap.config.js
export default {
  // ...
  mcp: { allowWrites: true },
}
```

```json
// ~/.claude.json
{
  "mcpServers": {
    "dappql": {
      "command": "npx",
      "args": ["-y", "@dappql/mcp"],
      "env": {
        "DAPPQL_DEFAULT_RPC_URL": "https://mainnet.base.org",
        "DAPPQL_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Signing keys *must* stay out of the committed JSON. Keep them in a local `.env` (gitignored) or your shell — never in `.mcp.json`.

For testnets and burner-wallet workflows this is fine. For mainnet, think about it twice, an agent with write access is blast-radius-equivalent to a deploy key. The simulate-first default still protects against revertable failures, but nothing protects against intentional transfers to the wrong address.

Default position: **keep `allowWrites: false`** and rely on `simulateWrite` for dry-runs. See [Safety model](/agents/mcp/safety).

## Verifying the connection

In Claude Code, type `/mcp` to see connected servers. `dappql` should appear with a green status and `(13 tools, 4 resources)` count.

If it doesn't appear:

- Restart the client after editing config.
- Check `~/.claude.json` syntax, JSON parse errors silently hide the server.
- Launch the binary directly to read stderr: `cd your-project && npx -y @dappql/mcp`.
- Make sure your `dap.config.js` is valid ESM (or CJS if you're not an ESM project).
- If using an env-based RPC (`DAPPQL_RPC_URL` or `DAPPQL_DEFAULT_RPC_URL`), verify the URL is reachable with `curl`.

## Next

- [Tools reference](/agents/mcp/tools), every tool's purpose and signature.
- [Resources reference](/agents/mcp/resources), `dappql://docs/library`, project guide, per-contract ABI.
- [Safety model](/agents/mcp/safety), how writes and codegen are gated.
- [Underscore case study](/agents/case-studies/underscore), real agent sessions.
