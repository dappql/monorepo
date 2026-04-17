# dappql

> Typed smart-contract codegen for dApps, built on [wagmi](https://wagmi.sh) + [viem](https://viem.sh). Point it at your ABIs, get back a fully typed SDK — plus a project-level `AGENTS.md` so AI coding agents produce correct code on the first try.

Part of the [DappQL](https://github.com/dappql/monorepo) toolchain. The CLI is what you run; the runtime libraries (`@dappql/react`, `@dappql/async`) are what your app imports.

## Install

```bash
npm install -g dappql
# or run via npx — no global install required
npx dappql
```

## Configure

Create `dapp.config.js` at the root of your project:

```js
export default {
  // Where to emit the typed contract modules
  targetPath: './src/contracts',

  // Set to true for an ESM project
  isModule: true,

  // Set to true to emit `sdk.ts` — a `createSdk(publicClient, walletClient)` factory
  // for shipping a publishable protocol SDK
  isSdk: false,

  // Controls the per-project AGENTS.md file (default: true)
  // - true: write ./AGENTS.md
  // - false: skip
  // - '<path>': custom location
  agentsFile: true,

  // Optional — needed if any contract omits its abi and you want dappql to fetch it
  etherscanApiKey: process.env.ETHERSCAN_API_KEY,
  chainId: 1,

  contracts: {
    Token: {
      address: '0x...',
      abi: [/* ... */],
    },
    ToDo: {
      address: '0x...',
      abi: [/* ... */],
    },
    // For contracts deployed at many addresses (user wallets, vaults, ERC20s)
    ERC20: {
      isTemplate: true,
      abi: [/* ... */],
    },
  },
}
```

Then run:

```bash
dappql
```

## What gets generated

For a config like the one above, `dappql` emits:

```
src/contracts/
├── Token.ts          # typed call / mutation / event helpers
├── ToDo.ts
├── ERC20.ts
├── index.ts          # re-exports each contract as a namespace
└── sdk.ts            # only if isSdk: true — createSdk() factory
```

Plus `AGENTS.md` at your project root, containing a table of every contract, its reads/writes/events, ABI-accurate argument placeholders, and the non-negotiable rules for using DappQL correctly — curated for AI coding agents.

Re-runs replace only the managed block in `AGENTS.md` (marked with `<!-- dappql:start --> ... <!-- dappql:end -->`), so hand-written content around it is preserved.

## Usage in your app

Once generated, your application imports from the contracts folder:

```tsx
import { Token, ToDo } from './src/contracts'
import { useContextQuery, useMutation } from '@dappql/react'

function Dashboard({ account }) {
  // Batched into a single multicall, typed end-to-end
  const { data } = useContextQuery({
    balance: Token.call.balanceOf(account),
    symbol: Token.call.symbol(),
    totalTasks: ToDo.call.totalTasks(),
  })

  const tx = useMutation(ToDo.mutation.addItem, 'Add task')

  return <button onClick={() => tx.send('Buy milk', 0n)}>Add</button>
}
```

See [`@dappql/react`](https://www.npmjs.com/package/@dappql/react) for the full React surface, or [`@dappql/async`](https://www.npmjs.com/package/@dappql/async) for non-React (scripts, servers, bots).

## ABI sources

`dappql` resolves ABIs in this order per contract:

1. `abi` field on the contract entry in `dapp.config.js` (most projects)
2. Local JSON file at `${abiSourcePath}/${ContractName}.json` (if configured)
3. Etherscan (if `etherscanApiKey` is set and the contract has an address)

Missing ABIs are reported and skipped.

## Related packages

| Package | Purpose |
| --- | --- |
| [`@dappql/react`](https://www.npmjs.com/package/@dappql/react) | React hooks, provider, query manager |
| [`@dappql/async`](https://www.npmjs.com/package/@dappql/async) | Non-React runtime — `query`, `mutate`, `iteratorQuery` |
| [`@dappql/codegen`](https://www.npmjs.com/package/@dappql/codegen) | The codegen engine — programmatic API, used by this CLI and by `@dappql/mcp` |
| [`@dappql/mcp`](https://www.npmjs.com/package/@dappql/mcp) | MCP server exposing your DappQL project to AI coding agents |

## Full documentation

[github.com/dappql/monorepo](https://github.com/dappql/monorepo)

## License

MIT
