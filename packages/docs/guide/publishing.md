# Publishing as an npm plugin

Once you have a working DappQL SDK ([sdk-generation](/guide/sdk-generation)), you can ship it as a first-class npm package that **both humans and AI agents consume**. Humans `pnpm add @your/dappql` and get typed contracts. AI agents with `@dappql/mcp` installed auto-discover the package in `node_modules` and gain live, typed access to every contract, ABI, and address the package carries.

This is how the DappQL ecosystem compounds. Every protocol that publishes becomes installable context.

## Quick start

Add a `package` block to `dapp.config.js`:

```js
export default {
  targetPath: './src/contracts',
  isSdk: true,
  chainId: 8453,
  contracts: { /* ... */ },

  package: {
    name: '@underscore/dappql',
    version: '1.0.0',
    license: 'MIT',
    protocol: {
      name: 'Underscore Finance',
      website: 'https://underscore.finance',
      docs: 'https://docs.underscore.finance',
      explorer: 'https://basescan.org',
      repo: 'https://github.com/underscore-finance/typescript-sdk',
    },
  },
}
```

Run:

```bash
npx dappql pack
```

This builds a self-contained publishable package at `./dappql-package/`:

```
dappql-package/
├── package.json         # main, exports map, and the dappql manifest field
├── README.md            # auto-generated from protocol metadata
├── AGENTS.md            # reused from codegen
├── abis.json            # { ContractName: Abi[] }
├── addresses.json       # { ContractName: address | undefined }
├── src/                 # TypeScript source
└── dist/                # compiled JS + .d.ts
```

Then publish it like any npm package:

```bash
cd dappql-package
npm publish --access public
```

## Config reference: `package`

| Field | Type | Description |
| --- | --- | --- |
| `name` | `string` **required** | npm package name (including scope if any) |
| `version` | `string` **required** | semver version |
| `description` | `string` | npm description; auto-generated from `protocol.name` if omitted |
| `license` | `string` | SPDX license (default `MIT`) |
| `outDir` | `string` | Output directory (default `./dappql-package`) |
| `source` | `string` | Path to a directory of user-authored TS to bundle alongside generated contracts (see below) |
| `main` | `string` | Entry file within `source`, relative path (default `index.ts`) |
| `protocol` | `object` | Metadata passed to agents via the MCP manifest |
| `protocol.name` | `string` | Human protocol name |
| `protocol.website` | `string` | Protocol homepage |
| `protocol.docs` | `string` | Docs URL — agents can read this for extra context |
| `protocol.explorer` | `string` | Block explorer URL |
| `protocol.repo` | `string` | Source repo URL |

Everything except `name` + `version` is optional.

## Enriching the SDK

Raw `createSdk` works fine for most use cases. For protocols with on-chain address registries, complex write flows, or multi-step helpers, wrap the factory in your own class and ship that as the package entry.

Add a `source` directory with your wrapper code:

```
my-protocol/
├── dapp.config.js
├── sdk-src/
│   ├── index.ts           # your wrapper, becomes the package entry
│   └── resolver.ts        # e.g. registry-backed address lookup
└── src/contracts/         # the DappQL-generated code (your project's targetPath)
```

```js
// dapp.config.js
package: {
  name: '@underscore/dappql',
  version: '1.0.0',
  source: './sdk-src',   // ← your wrapper source
  main: 'index.ts',      // ← entry within source
}
```

```ts
// sdk-src/index.ts
import createSdk from './contracts/sdk.js'
import type { SDK } from './contracts/sdk.js'
import { loadAddresses } from './resolver.js'
import type { PublicClient, WalletClient } from 'viem'

export class Underscore {
  readonly inner: SDK

  constructor(publicClient: PublicClient, walletClient?: WalletClient) {
    this.inner = createSdk(publicClient, walletClient, loadAddresses)
  }

  async walletCount() {
    return this.inner.Ledger.getNumUserWallets()
  }
}

export { createSdk }
export type { SDK }
```

When `source` is set, `dappql pack` copies your directory into the output and nests the generated contracts under `./contracts/`. Your wrapper imports from `./contracts/sdk.js` to get the typed factory. After compilation, the package exposes:

- `import { Underscore } from '@underscore/dappql'` — your enriched class (the default entry)
- `import createSdk from '@underscore/dappql/sdk'` — the raw factory
- `import * as Ledger from '@underscore/dappql/contracts'` — the typed contracts barrel
- `import abis from '@underscore/dappql/abis'` — raw ABIs JSON
- `import agents from '@underscore/dappql/agents'` — the AGENTS.md guide

Consumers choose the level of abstraction that fits.

## The manifest field

Every packed package.json gets a top-level `dappql` field that `@dappql/mcp` reads on startup:

```jsonc
{
  "name": "@underscore/dappql",
  "version": "1.0.0",
  "exports": { /* standard npm exports map */ },
  "dappql": {
    "manifestVersion": 1,
    "chainId": 8453,
    "protocol": {
      "name": "Underscore Finance",
      "website": "https://underscore.finance",
      "docs": "https://docs.underscore.finance",
      "explorer": "https://basescan.org",
      "repo": "https://github.com/underscore-finance/typescript-sdk"
    },
    "contracts": "./dist/contracts/index.js",
    "sdk":       "./dist/contracts/sdk.js",
    "abis":      "./abis.json",
    "addresses": "./addresses.json",
    "agents":    "./AGENTS.md"
  }
}
```

`@dappql/mcp` uses this to locate:

- **Contracts barrel** (`contracts`) for typed imports
- **SDK factory** (`sdk`) when an agent wants to wrap the raw createSdk
- **ABIs** (`abis.json`) — loaded directly into the MCP's tool context
- **Addresses** (`addresses.json`) — static deploy addresses when known; `undefined` for template contracts or dynamically resolved ones
- **Agents doc** (`AGENTS.md`) — optional per-package guide

Agents see every contract your package ships without you doing anything extra.

## Addresses and template contracts

`addresses.json` only carries static addresses that are known at pack time. For:

- **Template contracts** (`isTemplate: true`) — address is `undefined`; the consumer passes one at call time.
- **Dynamically resolved contracts** (address comes from an on-chain registry) — address is `undefined`; the consumer supplies an `addressResolver` when calling `createSdk`.

The agent side handles this gracefully: when it tries to call a contract with no address, the MCP surfaces a clear error asking for an `address` argument or nudging toward the registry pattern. Shipping dynamic resolution baked into the package is not recommended — any registry change would force a republish.

## The audience

The packaged bundle serves two consumers:

**Human developers.** They `pnpm add @underscore/dappql`, import the class or the raw `createSdk`, and write code with full IDE autocomplete and types inferred from the ABIs.

**AI agents.** Any project that installs both `@underscore/dappql` and `@dappql/mcp` gives its agents live, typed access to every contract the package ships. No additional setup. Read the agent-side behavior at [Plugins](/agents/mcp/plugins).

## Publishing workflow

Standard npm flow:

```bash
# Build and pack
npx dappql pack

# Dry-run to inspect what's about to ship
cd dappql-package
npm pack --dry-run

# Publish
npm publish --access public
```

Between versions, re-run `dappql pack` to regenerate with fresh ABIs from your Etherscan source or local files. The generated output is deterministic, CI-friendly, and overwrites the previous pack in place.

## Related

- [SDK generation](/guide/sdk-generation) — the underlying `isSdk: true` flag and what it emits.
- [Plugins (agents)](/agents/mcp/plugins) — how `@dappql/mcp` consumes packaged plugins.
- [Configuration](/guide/configuration) — full `dapp.config.js` reference.
