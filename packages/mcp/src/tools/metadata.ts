import type { ProjectContext } from '../types.js'
import { getContractAbi, summarizeAllContracts, summarizeContract } from '../contracts.js'

export const listContractsTool = {
  name: 'listContracts',
  description:
    'List every contract declared in the project\'s dapp.config.js. Returns name, shape (singleton | template), deploy address (if any), and per-contract method/event counts.',
  inputSchema: {
    type: 'object',
    properties: {},
    additionalProperties: false,
  },
  handler: async (_args: unknown, ctx: ProjectContext) => {
    const summaries = summarizeAllContracts(ctx.config)
    return {
      chainId: ctx.chainId,
      contracts: summaries.map((s) => ({
        name: s.name,
        shape: s.shape,
        address: s.address,
        readCount: s.reads.length,
        writeCount: s.writes.length,
        eventCount: s.events.length,
      })),
    }
  },
}

export const getContractTool = {
  name: 'getContract',
  description:
    'Get the full metadata for a single contract by name: ABI, method signatures (reads + writes), events, deploy address, and shape.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Contract name as declared in dapp.config.js' },
      includeAbi: {
        type: 'boolean',
        description: 'Include the raw ABI in the response. Defaults to false to keep the response compact.',
      },
    },
    required: ['name'],
    additionalProperties: false,
  },
  handler: async (args: { name: string; includeAbi?: boolean }, ctx: ProjectContext) => {
    const contract = ctx.config.contracts[args.name]
    if (!contract) throw new Error(`Contract not found: ${args.name}`)
    const summary = summarizeContract(args.name, contract)
    return {
      ...summary,
      ...(args.includeAbi ? { abi: getContractAbi(ctx.config, args.name) } : {}),
    }
  },
}

export const searchMethodsTool = {
  name: 'searchMethods',
  description:
    'Search methods (reads + writes) across every contract in the project. Returns ranked matches by substring and token overlap on method name. Useful when an agent knows what it wants to do but not which contract owns that method.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Free-text query; typically a partial method name like "balance" or a concept like "approve".',
      },
      kind: {
        type: 'string',
        enum: ['read', 'write', 'any'],
        description: 'Restrict to reads, writes, or both. Defaults to any.',
      },
      limit: { type: 'integer', minimum: 1, maximum: 100, description: 'Max results. Defaults to 20.' },
    },
    required: ['query'],
    additionalProperties: false,
  },
  handler: async (
    args: { query: string; kind?: 'read' | 'write' | 'any'; limit?: number },
    ctx: ProjectContext,
  ) => {
    const q = args.query.toLowerCase()
    const kind = args.kind ?? 'any'
    const limit = args.limit ?? 20
    const tokens = q.split(/[^a-z0-9]+/).filter(Boolean)

    type Hit = {
      contract: string
      kind: 'read' | 'write'
      method: string
      inputs: { name: string; type: string }[]
      outputs: { name: string; type: string }[]
      score: number
    }

    const hits: Hit[] = []
    for (const [contractName, contract] of Object.entries(ctx.config.contracts)) {
      const summary = summarizeContract(contractName, contract)
      const pools: { k: 'read' | 'write'; methods: typeof summary.reads }[] = []
      if (kind === 'any' || kind === 'read') pools.push({ k: 'read', methods: summary.reads })
      if (kind === 'any' || kind === 'write') pools.push({ k: 'write', methods: summary.writes })

      for (const { k, methods } of pools) {
        for (const m of methods) {
          const lower = m.name.toLowerCase()
          let score = 0
          if (lower === q) score += 100
          if (lower.startsWith(q)) score += 30
          if (lower.includes(q)) score += 15
          for (const t of tokens) {
            if (lower.includes(t)) score += 3
          }
          if (score > 0) {
            hits.push({
              contract: contractName,
              kind: k,
              method: m.name,
              inputs: m.inputs,
              outputs: m.outputs,
              score,
            })
          }
        }
      }
    }

    hits.sort((a, b) => b.score - a.score || a.contract.localeCompare(b.contract) || a.method.localeCompare(b.method))
    return { query: args.query, total: hits.length, results: hits.slice(0, limit) }
  },
}

export const projectInfoTool = {
  name: 'projectInfo',
  description:
    'Get high-level context for the current DappQL project: config path, chain, RPC host, contract count, writes policy.',
  inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  handler: async (_args: unknown, ctx: ProjectContext) => {
    const url = (() => {
      try {
        return new URL(ctx.rpcUrl).host
      } catch {
        return '<invalid>'
      }
    })()
    return {
      configPath: ctx.configPath,
      root: ctx.root,
      chainId: ctx.chainId ?? null,
      rpcHost: url,
      contractCount: Object.keys(ctx.config.contracts).length,
      targetPath: ctx.config.targetPath,
      isSdk: Boolean(ctx.config.isSdk),
      writesEnabled: ctx.writesEnabled,
      writesPolicy: ctx.writesReason,
      codegenEnabled: ctx.codegenEnabled,
      codegenPolicy: ctx.codegenReason,
    }
  },
}
