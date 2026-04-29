import { randomUUID } from 'node:crypto'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'

import { createDappqlServer } from './server.js'
import type { ProjectContext } from './types.js'

export type HttpMode = 'stateful' | 'stateless'

export type StartHttpServerOptions = {
  port: number
  /** Stateful: long-lived sessions in-memory (single-instance Node servers).
   *  Stateless: every request is independent — required for serverless
   *  (Vercel, Cloudflare Workers) where in-memory state doesn't survive
   *  cold starts or span instances. Defaults to 'stateful'. */
  mode?: HttpMode
}

/** Streamable HTTP MCP server.
 *
 *  In **stateful** mode (default) each client `initialize` request gets a
 *  session id; subsequent calls present it in `mcp-session-id` and reuse the
 *  same transport. Server-pushed notifications work. Single in-memory map of
 *  sessions — won't span instances.
 *
 *  In **stateless** mode (`mode: 'stateless'`) every request creates a fresh
 *  transport + server, handles the one request, disposes. No session header,
 *  no GET/DELETE support, no notifications. Required for serverless deploys.
 *
 *  Endpoints (all on `/mcp`):
 *    - POST  /mcp   client→server JSON-RPC requests
 *    - GET   /mcp   SSE stream for server→client notifications (stateful only)
 *    - DELETE /mcp  ends a session (stateful only)
 */
export async function startHttpServer(
  ctx: ProjectContext,
  portOrOptions: number | StartHttpServerOptions,
): Promise<void> {
  const opts: StartHttpServerOptions =
    typeof portOrOptions === 'number' ? { port: portOrOptions } : portOrOptions
  const mode: HttpMode = opts.mode ?? 'stateful'
  const port = opts.port

  // Stateful only: sessionId → transport, cleared on transport close.
  const sessions = new Map<string, StreamableHTTPServerTransport>()

  // Stateful only: one Server reused across sessions; its tools are stateless
  // and the project context never changes after startup. Stateless mode
  // builds a fresh server per request to avoid lifecycle entanglement.
  const sharedServer = mode === 'stateful' ? createDappqlServer(ctx) : null

  const server = createServer(async (req, res) => {
    // CORS for browser-based MCP clients (rare but cheap to support).
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS')
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, mcp-session-id, mcp-protocol-version, last-event-id',
    )
    res.setHeader('Access-Control-Expose-Headers', 'mcp-session-id')

    if (req.method === 'OPTIONS') {
      res.writeHead(204).end()
      return
    }

    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(
        JSON.stringify({
          ok: true,
          chainId: ctx.chainId ?? null,
          contracts: Object.keys(ctx.config.contracts).length,
          plugins: ctx.plugins.map((p) => `${p.name}@${p.version ?? '?'}`),
          sessions: sessions.size,
        }),
      )
      return
    }

    if (req.url !== '/mcp' && req.url !== '/mcp/') {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not found. MCP endpoint is /mcp.')
      return
    }

    try {
      if (req.method === 'POST') {
        if (mode === 'stateless') {
          await handlePostStateless(req, res, ctx)
        } else {
          await handlePost(req, res, sessions, sharedServer!)
        }
      } else if (req.method === 'GET' || req.method === 'DELETE') {
        if (mode === 'stateless') {
          // No sessions exist in stateless mode, so there's nothing to stream
          // or terminate. Tell the client this method isn't available here.
          res.writeHead(405, { 'Content-Type': 'application/json', Allow: 'POST' })
          res.end(JSON.stringify({ error: 'GET/DELETE not supported in stateless mode' }))
        } else {
          await handleSessionRequest(req, res, sessions)
        }
      } else {
        res.writeHead(405, { 'Content-Type': 'text/plain' })
        res.end('Method not allowed.')
      }
    } catch (err) {
      process.stderr.write(`[@dappql/mcp] HTTP handler error: ${(err as Error).message}\n`)
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null }))
      }
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      process.stderr.write(
        `[@dappql/mcp] HTTP transport (${mode}) listening on http://0.0.0.0:${port}/mcp\n`,
      )
      resolve()
    })
  })
}

async function handlePostStateless(
  req: IncomingMessage,
  res: ServerResponse,
  ctx: ProjectContext,
): Promise<void> {
  const body = await readJsonBody(req)
  // Fresh server + transport per request. The MCP SDK ties their lifecycle
  // together (transport close → server end), so sharing one server across
  // independent requests would shut everyone down on the first disconnect.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  const server = createDappqlServer(ctx)
  res.on('close', () => {
    transport.close().catch(() => {})
    server.close().catch(() => {})
  })
  await server.connect(transport)
  await transport.handleRequest(req, res, body)
}

async function handlePost(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, StreamableHTTPServerTransport>,
  sharedServer: ReturnType<typeof createDappqlServer>,
): Promise<void> {
  const body = await readJsonBody(req)
  const sessionId = headerString(req.headers['mcp-session-id'])

  let transport: StreamableHTTPServerTransport
  const existing = sessionId ? sessions.get(sessionId) : undefined
  if (existing) {
    transport = existing
  } else if (!sessionId && isInitializeRequest(body)) {
    const newTransport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, newTransport)
      },
    })
    newTransport.onclose = () => {
      const sid = newTransport.sessionId
      if (sid) sessions.delete(sid)
    }
    await sharedServer.connect(newTransport)
    transport = newTransport
  } else {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: no valid session id and not an initialize request',
        },
        id: null,
      }),
    )
    return
  }

  await transport.handleRequest(req, res, body)
}

async function handleSessionRequest(
  req: IncomingMessage,
  res: ServerResponse,
  sessions: Map<string, StreamableHTTPServerTransport>,
): Promise<void> {
  const sessionId = headerString(req.headers['mcp-session-id'])
  if (!sessionId || !sessions.has(sessionId)) {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    res.end('Invalid or missing mcp-session-id header')
    return
  }
  await sessions.get(sessionId)!.handleRequest(req, res)
}

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(undefined)
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(new Error(`Invalid JSON body: ${(e as Error).message}`))
      }
    })
    req.on('error', reject)
  })
}

function headerString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0]
  return v
}
