# Plugins

`@dappql/mcp` auto-discovers any npm package in your project's `node_modules` that ships a DappQL manifest. Those packages become **plugins**: their contracts, ABIs, addresses, and protocol metadata are exposed to your AI agent alongside the local project's contracts.

Install a plugin:

```bash
pnpm add @underscore/dappql
```

Restart your MCP client. That's it. The agent now has typed access to 75+ contracts from Underscore Finance in addition to whatever lives in your own `dapp.config.js`.

## How discovery works

On startup, `@dappql/mcp` walks `node_modules/` looking for any `package.json` with a top-level `dappql` field ([what that field looks like](/guide/publishing#the-manifest-field)). Both flat (`node_modules/@foo/bar`) and pnpm-hoisted layouts are supported. Transitive installs count — if a plugin sneaks in through a dep's dep, the agent sees it.

The server logs discovered plugins at startup:

```
[@dappql/mcp] Project: /path/to/your/dapp.config.js
[@dappql/mcp] Chain: 8453
[@dappql/mcp] Contracts: 4
[@dappql/mcp] Plugins: 2 — @underscore/dappql@1.0.0 (75), @aerodrome/dappql@0.3.0 (12)
[@dappql/mcp] Writes: disabled — ...
```

"75" and "12" are contract counts per plugin.

## The `source` field

Every tool that returns or accepts contracts now carries a `source`:

- `"project"` — your local `dapp.config.js`
- The plugin's package name — e.g. `"@underscore/dappql"`

Example `listContracts` output with a plugin installed:

```json
{
  "chainId": 8453,
  "projectContracts": 3,
  "plugins": [
    { "name": "@underscore/dappql", "version": "1.0.0", "chainId": 8453, "contractCount": 75 }
  ],
  "contracts": [
    { "source": "project", "name": "MyToken", "shape": "singleton", "address": "0x…", "readCount": 8, "writeCount": 3, "eventCount": 2 },
    { "source": "@underscore/dappql", "name": "Ledger", "shape": "singleton", "address": "0x…", "readCount": 14, "writeCount": 0, "eventCount": 4 },
    { "source": "@underscore/dappql", "name": "UndyUsd", "shape": "singleton", "address": "0x…", "readCount": 22, "writeCount": 5, "eventCount": 6 }
  ]
}
```

## Disambiguating contract names

When a project and a plugin both declare a contract with the same name (say, `Token`), the agent must pick a source:

```
agent: getContract({ name: "Token" })
→ Error: Ambiguous contract name "Token" — exists in: project, @underscore/dappql.
  Pass the `source` argument to disambiguate.

agent: getContract({ name: "Token", source: "@underscore/dappql" })
→ { "source": "@underscore/dappql", "name": "Token", "reads": [...], ... }
```

Chain tools (`callRead`, `multicall`, `simulateWrite`, `callWrite`, `getEvents`) accept the same `source` argument. A multicall can mix project + plugin contracts in a single batch:

```json
{
  "calls": [
    { "key": "myBalance",    "contract": "MyToken",  "source": "project",              "method": "balanceOf", "args": ["0x…"] },
    { "key": "undyBalance",  "contract": "UndyUsd",  "source": "@underscore/dappql",   "method": "balanceOf", "args": ["0x…"] }
  ]
}
```

All routed through one RPC batch.

## Plugin metadata

`listPlugins` returns everything `@dappql/mcp` knows about each installed plugin:

```json
{
  "total": 1,
  "plugins": [
    {
      "name": "@underscore/dappql",
      "version": "1.0.0",
      "chainId": 8453,
      "protocol": {
        "name": "Underscore Finance",
        "website": "https://underscore.finance",
        "docs": "https://docs.underscore.finance",
        "explorer": "https://basescan.org",
        "repo": "https://github.com/underscore-finance/typescript-sdk"
      },
      "contracts": ["AddyRegistry", "Ledger", "MissionControl", "UndyUsd", /* … */],
      "hasAgentsDoc": true
    }
  ]
}
```

The `protocol.docs` URL is a hint for the agent: if it needs to reason about the protocol beyond what's in the ABIs, it can WebFetch the docs. `protocol.repo` points to the source, `protocol.explorer` gives it a place to look up on-chain activity.

## Transaction decoding

`getTransaction` decodes function calls and event logs against every known ABI — project first, then plugins. Each decoded entry tags its `source`, so you can tell whether a log was emitted by a contract in your project or in a plugin's registry.

Useful when analyzing txs that touch multi-protocol flows: an Underscore wallet operation routing through Aerodrome Swap logs decodes both sides automatically if both plugins are installed.

## Addresses and dynamic resolution

Plugins ship an `addresses.json` with whatever static addresses the publisher knew at pack time. Template contracts and dynamically resolved contracts have `undefined` entries.

When the agent calls a plugin contract with no known address, the MCP raises a clear error: pass an `address` argument, or check the plugin's docs for how addresses resolve. Agents can also introspect the plugin's contracts to find a registry contract (`AddressProvider`, `Addys`, etc.) and resolve via a `callRead`.

This is intentional. Baking a static resolver into every published artifact would force republishing on every registry change; leaving resolution live means agents always see the current chain state.

## Publishing your own plugin

See [Publishing as an npm plugin](/guide/publishing) for the publisher side. The short version:

```js
// dapp.config.js
package: {
  name: '@myprotocol/dappql',
  version: '1.0.0',
  protocol: {
    name: 'MyProtocol',
    docs: 'https://docs.myprotocol.xyz',
  },
}
```

Then:

```bash
npx dappql pack
cd dappql-package
npm publish --access public
```

Anyone installing your package and running `@dappql/mcp` immediately gives their agent typed context for your protocol.

## Related

- [Publishing as an npm plugin](/guide/publishing) — the publisher side.
- [MCP setup](/agents/mcp/setup) — how to wire `@dappql/mcp` into your agent client.
- [Tools](/agents/mcp/tools) — reference for every MCP tool the agent can call.
