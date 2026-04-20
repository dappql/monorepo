# Configuration

`dap.config.js` is the single source of truth for DappQL codegen, which contracts to emit, where to put them, what flags to set, what MCP gates to open. This page is the full field reference.

## Minimal config

```js
export default {
  targetPath: './src/contracts',
  contracts: {
    Token: { address: '0x...', abi: [/* ... */] },
  },
}
```

Run `npx dappql` and you get `./src/contracts/Token.ts` plus `./src/contracts/index.ts`.

## Full field reference

```ts
type Config = {
  // Required
  contracts: Record<string, ContractConfig>
  targetPath: string

  // Codegen behavior
  isModule?: boolean
  isSdk?: boolean
  agentsFile?: boolean | string

  // ABI fetching
  abiSourcePath?: string
  etherscanApiKey?: string
  etherscanApi?: string
  chainId?: number

  // @dappql/mcp
  mcp?: {
    rpc?: string
    allowWrites?: boolean
    allowCodegen?: boolean
  }
}

type ContractConfig = {
  address?: `0x${string}`
  abi?: AbiItem[]
  isTemplate?: boolean
}
```

### `contracts` (required)

A map of contract names to `{ address, abi, isTemplate }`. The key becomes the module name in generated code (`ContractName.ts`), the namespace import in your app, and the resolver key for `addressResolver`.

```js
contracts: {
  Token: {
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    abi: [/* ABI JSON */],
  },
  USDC: {
    address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    abi: [/* ABI JSON */],
  },
  // Template, no single canonical address; use .at() per call
  ERC20: {
    isTemplate: true,
    abi: [/* ERC20 ABI */],
  },
}
```

Per-contract fields:

- **`address`**, the deploy address. Required for singletons. Optional for templates, but useful as a canonical-implementation reference.
- **`abi`**, the full ABI array. If omitted and `etherscanApiKey` is set, the CLI will fetch it.
- **`isTemplate`**, flag contracts deployed at many addresses. Generated code omits the baked-in `deployAddress`, and every call requires `.at(addr)` or an `address` option on mutations. See [Template contracts](/guide/templates).

### `targetPath` (required)

Where to write generated contract modules. Relative to the config file's directory. Conventional: `'./src/contracts'`.

The CLI cleans this directory before emitting, so keep it dedicated to generated output, don't mix in hand-written files.

### `isModule`

```js
isModule: true  // emits ESM import paths (import from './X.js')
isModule: false // default, omits extensions, matches TS/CJS projects
```

Set to `true` for modern ESM projects (your package.json has `"type": "module"`). For most Next.js/Vite apps, the default is fine.

### `isSdk`

```js
isSdk: true
```

Flip on to additionally emit `${targetPath}/sdk.ts`, a `createSdk(publicClient, walletClient, addressResolver?)` factory that wraps every contract into a single typed object. This is how protocols ship their frontend primitives as publishable SDKs. See [SDK generation](/guide/sdk-generation).

### `agentsFile`

```js
agentsFile: true                  // default, write ./AGENTS.md at repo root
agentsFile: false                 // opt out
agentsFile: './docs/AGENTS.md'    // custom location
```

Controls the per-project `AGENTS.md` the CLI generates for AI coding agents. See [Generated AGENTS.md](/agents/generated-agents-md).

### `chainId`

```js
chainId: 8453  // Base mainnet
```

Used in two places:
1. Included in the generated `AGENTS.md` setup section.
2. Passed to Etherscan when fetching ABIs for contracts that omit them.

Not required if every contract has an `abi` in config.

### `abiSourcePath`

```js
abiSourcePath: './abis'
```

Load ABIs from local JSON files named `${ContractName}.json`. Checked before falling back to Etherscan. Useful when you generate ABIs from Foundry/Hardhat builds.

### `etherscanApiKey` + `etherscanApi`

```js
etherscanApiKey: process.env.ETHERSCAN_API_KEY,
etherscanApi: 'https://api.etherscan.io/v2/api',  // default
```

If a contract omits `abi`, the CLI fetches it from Etherscan. Set `etherscanApi` to override, the v2 API works for Basescan, Arbiscan, and other chain explorers that mirror it.

### `mcp`

Settings for [`@dappql/mcp`](/agents/why-ai-first):

```js
mcp: {
  rpc: 'https://mainnet.base.org',  // overrides DAPPQL_RPC_URL env
  allowWrites: false,               // gate for the callWrite tool
  allowCodegen: false,              // gate for the regenerate tool
}
```

All optional. `rpc` is consulted before the env var; `allowWrites` and `allowCodegen` default to `false`. See [Safety model](/agents/mcp/safety).

## Typical configurations

### React app with embedded ABIs

```js
export default {
  targetPath: './src/contracts',
  isModule: true,
  agentsFile: true,
  contracts: {
    Token: { address: '0x...', abi: [/* ... */] },
    ToDo:  { address: '0x...', abi: [/* ... */] },
  },
}
```

### Protocol shipping a publishable SDK

```js
export default {
  name: 'My Protocol SDK',
  targetPath: './src/contracts',
  chainId: 8453,
  isModule: true,
  isSdk: true,
  contracts: {
    Factory:    { address: '0x...', abi: [/* ... */] },
    Registry:   { address: '0x...', abi: [/* ... */] },
    UserVault:  { isTemplate: true, abi: [/* ... */] },
    ERC20:      { isTemplate: true, abi: [/* ... */] },
  },
}
```

### Auto-fetched ABIs from Etherscan

```js
export default {
  targetPath: './src/contracts',
  chainId: 1,
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  contracts: {
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  },
}
```

ABIs resolve per contract in this order: embedded `abi` → local JSON at `abiSourcePath/ContractName.json` → Etherscan.

### MCP-ready with gated codegen

```js
export default {
  targetPath: './src/contracts',
  isSdk: true,
  contracts: { /* ... */ },
  mcp: {
    rpc: 'https://mainnet.base.org',
    allowCodegen: true,   // lets the MCP regenerate tool run
    // allowWrites left off, safest default
  },
}
```

## Generated output

After `npx dappql`:

```
./src/contracts/
  ├── Token.ts           # per-contract: abi, call, mutation, events, deployAddress
  ├── ToDo.ts
  ├── ERC20.ts           # isTemplate: true, no deployAddress, .at() required
  ├── index.ts           # re-exports each contract as a namespace
  └── sdk.ts             # only when isSdk: true
```

Plus a project-level `AGENTS.md` (unless `agentsFile: false`).

## File format and extensions

- `dap.config.js`, the conventional filename. The CLI also accepts `dap.config.mjs` and `dap.config.cjs`.
- Use `export default` (ESM) or `module.exports = { ... }` (CJS) depending on your project.
- The file is imported at runtime by the CLI; any JavaScript you'd expect works, dynamic construction, env vars, conditional logic.

## Dynamic configurations

The config file is just JavaScript, build it programmatically if that fits:

```js
import manifest from './manifest.json' with { type: 'json' }

export default {
  targetPath: './src/contracts',
  chainId: manifest.chainId,
  contracts: Object.fromEntries(
    Object.entries(manifest.contracts).map(
      ([name, { address, abi }]) => [name, { address, abi }]
    ),
  ),
}
```

Perfect for generated manifests (Foundry's `out/` directory, a deploy pipeline that spits out addresses, or a cross-chain build that iterates over a list of chains).

## Related

- [Getting started](/guide/getting-started), the short walkthrough.
- [SDK generation](/guide/sdk-generation), the `isSdk: true` flow.
- [Templates](/guide/templates), when to flag a contract as a template.
- [Generated AGENTS.md](/agents/generated-agents-md), what the `agentsFile` flag controls.
- [Safety model](/agents/mcp/safety), the `mcp` block in depth.
