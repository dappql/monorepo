/**
 * Library entry point for `@dappql/mcp`. Pure re-exports — no side effects
 * at import time. Safe to import from serverless functions, custom servers,
 * tests, or other libraries.
 *
 * The CLI behavior (.env auto-load, arg parsing, stdio/HTTP server boot,
 * process.exit on failure) lives in `cli.ts` and is invoked only by the
 * `dappql-mcp` bin script.
 */

export { createDappqlServer } from './server.js'
export { loadProjectContext } from './project.js'
export { startHttpServer, type HttpMode, type StartHttpServerOptions } from './http.js'
export type { ProjectContext, DappConfig, McpConfigExtension } from './types.js'
