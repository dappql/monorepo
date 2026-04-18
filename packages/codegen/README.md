# @dappql/codegen

> The framework-agnostic codegen engine for [DappQL](https://github.com/dappql/core). Emits typed contract modules, the optional SDK factory, and the project-level `AGENTS.md` — from a plain `{ contracts, targetPath, ... }` config.

Shared core used by the [`dappql`](https://www.npmjs.com/package/dappql) CLI and the [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) server. Most users reach DappQL through the CLI — you only need `@dappql/codegen` directly if you're building tooling around it (an MCP server, a VSCode extension, a CI diff linter, a hosted platform).

## Install

```bash
npm install @dappql/codegen
```

## Programmatic API

```ts
import {
  createContractsCollection,
  createAgentsFile,
  type Config,
  type ContractConfig,
} from '@dappql/codegen'

const contracts: (ContractConfig & { contractName: string })[] = [
  {
    contractName: 'Token',
    address: '0x...',
    abi: [/* ... */],
  },
]

// Emit one typed .ts per contract, plus index.ts (and sdk.ts if isSdk: true).
// rootDir defaults to process.cwd(); pass an explicit path for use from
// outside the project (tooling, agents, CI).
createContractsCollection(
  contracts,
  './src/contracts',  // targetPath — relative to rootDir
  true,               // isModule  — emit ESM import paths
  false,              // isSdk     — emit the createSdk factory
  '/path/to/project', // rootDir   — optional
)

// Emit (or update) the project's AGENTS.md file for AI coding agents.
// Re-runs replace only the managed block; hand-written content around it
// is preserved.
createAgentsFile(contracts, {
  targetPath: './src/contracts',
  isModule: true,
  isSdk: false,
  chainId: 1,
  agentsFile: true,          // true | false | '<path>'
  rootDir: '/path/to/project',
})
```

## Types

All types are exported for consumers:

```ts
import type {
  Address,
  AbiFunction,
  AbiParameter,
  ContractConfig,
  Contracts,
  Config,
} from '@dappql/codegen'
```

These replace the ambient globals that used to live in the `dappql` CLI, so tooling can now type its own surfaces in terms of the same shapes DappQL emits.

## When to use this directly

- Building an MCP server, plugin, or devtool that needs to regenerate contract modules at runtime.
- Writing a CI check that compares freshly regenerated output against what's committed.
- Embedding codegen into a framework adapter (custom Vite plugin, Next.js integration, etc.).

For a vanilla dApp, use the [`dappql`](https://www.npmjs.com/package/dappql) CLI instead — it handles config loading, ABI fetching from Etherscan, and logging.

## Related packages

| Package | Purpose |
| --- | --- |
| [`dappql`](https://www.npmjs.com/package/dappql) | The CLI — `dappql` binary wrapping this engine with ABI fetching and logging |
| [`@dappql/react`](https://www.npmjs.com/package/@dappql/react) | React hooks, provider, query manager |
| [`@dappql/async`](https://www.npmjs.com/package/@dappql/async) | Non-React runtime — `query`, `mutate`, `iteratorQuery` |
| [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) | MCP server — consumes `@dappql/codegen` to expose a `regenerate` tool to AI coding agents |

## Full documentation

[github.com/dappql/core](https://github.com/dappql/core)

## License

MIT
