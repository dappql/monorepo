# Configuration

::: info
Full reference coming soon. For now, see the field-by-field walkthrough in [Getting started](/guide/getting-started) and the [CLI README](https://github.com/dappql/core/blob/main/packages/cli/README.md).
:::

`dap.config.js` accepts:

```ts
export default {
  targetPath: string,           // where to emit generated contract modules
  isModule: boolean,            // emit ESM import paths
  isSdk: boolean,               // emit a createSdk factory — see SDK generation
  agentsFile: boolean | string, // write per-project AGENTS.md (default true)
  chainId: number,              // for viem chain defaults in the generated SDK
  abiSourcePath: string,        // load ABIs from local JSON files
  etherscanApiKey: string,      // fetch missing ABIs from Etherscan
  etherscanApi: string,         // override Etherscan API base URL
  contracts: {
    [name: string]: {
      address?: `0x${string}`,
      abi?: AbiItem[],
      isTemplate?: boolean,     // contract deployed at many addresses (user wallets, ERC20s)
    }
  },
  mcp: {
    rpc?: string,               // @dappql/mcp — overrides DAPPQL_RPC_URL env
    allowWrites?: boolean,      // double-gate with DAPPQL_PRIVATE_KEY / MNEMONIC env
    allowCodegen?: boolean,     // lets the MCP `regenerate` tool run
  }
}
```

## See also

- [SDK generation](/guide/sdk-generation) — `isSdk` in depth.
- [Template contracts](/guide/templates) — `isTemplate` patterns.
- [MCP safety model](/agents/mcp/safety) — the `mcp` block.
