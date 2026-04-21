import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { listResources, readResource } from './resources.js'
import {
  callReadTool,
  callWriteTool,
  getEventsTool,
  getTransactionTool,
  multicallTool,
  simulateWriteTool,
} from './tools/chain.js'
import { regenerateTool } from './tools/codegen.js'
import {
  chainStateTool,
  getContractTool,
  getDappqlReferenceTool,
  listContractsTool,
  listPluginsTool,
  projectInfoTool,
  searchMethodsTool,
} from './tools/metadata.js'
import type { ProjectContext } from './types.js'

type Tool = {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  handler: (args: any, ctx: ProjectContext) => Promise<unknown>
}

function makeToolRegistry(ctx: ProjectContext): Map<string, Tool> {
  const tools: Tool[] = [
    getDappqlReferenceTool,
    projectInfoTool,
    chainStateTool,
    listContractsTool,
    listPluginsTool,
    getContractTool,
    searchMethodsTool,
    callReadTool,
    multicallTool,
    getEventsTool,
    getTransactionTool,
    simulateWriteTool,
    callWriteTool,
    regenerateTool,
  ]
  return new Map(tools.map((t) => [t.name, t]))
}

function toContentText(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}

export function createDappqlServer(ctx: ProjectContext): Server {
  const server = new Server(
    { name: '@dappql/mcp', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {} } },
  )

  const registry = makeToolRegistry(ctx)

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: Array.from(registry.values()).map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
  }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = registry.get(req.params.name)
    if (!tool) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${req.params.name}` }],
      }
    }
    try {
      const result = await tool.handler(req.params.arguments ?? {}, ctx)
      return { content: [{ type: 'text', text: toContentText(result) }] }
    } catch (e) {
      return {
        isError: true,
        content: [{ type: 'text', text: (e as Error).message }],
      }
    }
  })

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: listResources(ctx),
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const { mimeType, text } = readResource(req.params.uri, ctx)
    return {
      contents: [{ uri: req.params.uri, mimeType, text }],
    }
  })

  return server
}
