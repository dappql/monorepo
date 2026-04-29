import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { startHttpServer, type HttpMode } from './http.js'
import { loadProjectContext } from './project.js'
import { createDappqlServer } from './server.js'

// Auto-load `.env` from cwd so users can keep secrets (RPC URL, signing keys)
// in .env instead of wiring them through the MCP client's env block. Silent
// no-op when the file is absent or the Node runtime lacks loadEnvFile (<20.12).
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile()
    process.stderr.write('[@dappql/mcp] Loaded .env from cwd\n')
  }
} catch {
  // .env absent or unreadable — fall back to whatever is already in process.env.
}

/** Detects whether the user wants HTTP transport instead of the default stdio.
 *  HTTP is opt-in via either `--http[=PORT]` flag or `DAPPQL_MCP_HTTP_PORT`
 *  env var. Stdio remains the default so existing MCP-client integrations
 *  (Claude Code, Codex, Cursor) keep working unchanged. */
function resolveHttpPort(): number | null {
  const flag = process.argv.find((a) => a === '--http' || a.startsWith('--http='))
  if (flag) {
    const eq = flag.indexOf('=')
    const value = eq >= 0 ? flag.slice(eq + 1) : process.env.DAPPQL_MCP_HTTP_PORT
    const parsed = value ? Number(value) : 3000
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid HTTP port: ${value}`)
    }
    return parsed
  }
  const envPort = process.env.DAPPQL_MCP_HTTP_PORT?.trim()
  if (envPort) {
    const parsed = Number(envPort)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      throw new Error(`Invalid DAPPQL_MCP_HTTP_PORT: ${envPort}`)
    }
    return parsed
  }
  return null
}

/** HTTP transport mode. Defaults to 'stateful' (in-memory sessions, ideal for
 *  long-running Node servers). Flip to 'stateless' for serverless deploys
 *  (Vercel, Cloudflare Workers) where state can't span function invocations. */
function resolveHttpMode(): HttpMode {
  const flag = process.argv.includes('--stateless')
  const env = process.env.DAPPQL_MCP_STATELESS?.trim().toLowerCase()
  const envEnabled = env === '1' || env === 'true' || env === 'yes'
  return flag || envEnabled ? 'stateless' : 'stateful'
}

async function main() {
  const ctx = await loadProjectContext()
  if (!ctx) {
    process.stderr.write(
      '[@dappql/mcp] Nothing to introspect: no dap.config.js found walking up from cwd, and no DappQL plugins in node_modules. Install a DappQL SDK (e.g. `npm install @underscore-finance/sdk`) or add a dap.config.js to this project.\n',
    )
    process.exit(1)
  }

  process.stderr.write(`[@dappql/mcp] Project: ${ctx.configPath ?? `${ctx.root} (plugin-only, no dap.config.js)`}\n`)
  process.stderr.write(`[@dappql/mcp] Chain: ${ctx.chainId ?? 'unspecified'}\n`)
  process.stderr.write(`[@dappql/mcp] Contracts: ${Object.keys(ctx.config.contracts).length}\n`)
  if (ctx.plugins.length) {
    const pluginSummary = ctx.plugins
      .map((p) => `${p.name}${p.version ? `@${p.version}` : ''} (${Object.keys(p.contracts).length})`)
      .join(', ')
    process.stderr.write(`[@dappql/mcp] Plugins: ${ctx.plugins.length} — ${pluginSummary}\n`)
  }
  process.stderr.write(`[@dappql/mcp] Writes: ${ctx.writesEnabled ? 'ENABLED' : 'disabled'} — ${ctx.writesReason}\n`)
  process.stderr.write(`[@dappql/mcp] Codegen: ${ctx.codegenEnabled ? 'ENABLED' : 'disabled'} — ${ctx.codegenReason}\n`)

  const httpPort = resolveHttpPort()
  if (httpPort !== null) {
    const mode: HttpMode = resolveHttpMode()
    await startHttpServer(ctx, { port: httpPort, mode })
    return
  }

  const server = createDappqlServer(ctx)
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((e) => {
  process.stderr.write(`[@dappql/mcp] Fatal: ${(e as Error).message}\n`)
  process.exit(1)
})

export { createDappqlServer, loadProjectContext, startHttpServer }
