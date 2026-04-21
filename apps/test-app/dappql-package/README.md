# @dappql/test-app-contracts

ToDo demo contracts (Sepolia) packaged via dappql pack

## Install

```bash
pnpm add @dappql/test-app-contracts
```

## Use with DappQL MCP

Once installed, `@dappql/mcp` auto-discovers this package as a plugin and exposes its contracts, ABIs, and SDK to your AI coding agent.

## Use the SDK directly

```ts
import createSdk from '@dappql/test-app-contracts/sdk'
import { createPublicClient, http } from 'viem'

const publicClient = createPublicClient({ transport: http() })
const sdk = createSdk(publicClient)
```

## Links

- Website: https://todo.dappql.com
- Docs: https://dappql.com
- Explorer: https://sepolia.etherscan.io
- Repo: https://github.com/dappql/core

---

Built with [DappQL](https://dappql.com).
