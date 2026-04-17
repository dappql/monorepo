import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { loadProjectContext } from './project.js'
import { createDappqlServer } from './server.js'

async function main() {
  const ctx = await loadProjectContext()
  if (!ctx) {
    process.stderr.write(
      '[@dappql/mcp] No dapp.config.js found walking up from cwd. The MCP server needs a DappQL project to introspect.\n',
    )
    process.exit(1)
  }

  process.stderr.write(`[@dappql/mcp] Project: ${ctx.configPath}\n`)
  process.stderr.write(`[@dappql/mcp] Chain: ${ctx.chainId ?? 'unspecified'}\n`)
  process.stderr.write(`[@dappql/mcp] Contracts: ${Object.keys(ctx.config.contracts).length}\n`)
  process.stderr.write(`[@dappql/mcp] Writes: ${ctx.writesEnabled ? 'ENABLED' : 'disabled'} — ${ctx.writesReason}\n`)
  process.stderr.write(`[@dappql/mcp] Codegen: ${ctx.codegenEnabled ? 'ENABLED' : 'disabled'} — ${ctx.codegenReason}\n`)

  const server = createDappqlServer(ctx)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  process.stderr.write(`[@dappql/mcp] Fatal: ${(e as Error).message}\n`)
  process.exit(1)
})

export { createDappqlServer, loadProjectContext }
