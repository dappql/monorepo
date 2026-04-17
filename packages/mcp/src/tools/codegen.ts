import { createAgentsFile, createContractsCollection, type ContractConfig } from '@dappql/codegen'

import type { ProjectContext } from '../types.js'

type GeneratedContract = ContractConfig & { contractName: string }

function collectContracts(ctx: ProjectContext): { valid: GeneratedContract[]; missing: string[] } {
  const valid: GeneratedContract[] = []
  const missing: string[] = []
  for (const [name, contract] of Object.entries(ctx.config.contracts)) {
    const contractName = name.replaceAll(' ', '')
    if (contract.abi) {
      valid.push({ ...contract, contractName })
    } else {
      missing.push(contractName)
    }
  }
  valid.sort((a, b) => (a.contractName < b.contractName ? -1 : 1))
  return { valid, missing }
}

export const regenerateTool = {
  name: 'regenerate',
  description:
    'Re-run DappQL codegen against the project\'s dapp.config.js. Writes typed contract modules into `targetPath`, the SDK factory (if `isSdk` is set), and updates the project AGENTS.md. Gated: requires `mcp.allowCodegen: true` in dapp.config.js. Only emits for contracts whose ABI is already embedded in the config — contracts relying on Etherscan fetching must be regenerated via the `dappql` CLI.',
  inputSchema: {
    type: 'object',
    properties: {
      dryRun: {
        type: 'boolean',
        description:
          'If true, report what would be written without touching the filesystem. Defaults to false.',
      },
    },
    additionalProperties: false,
  },
  handler: async (args: { dryRun?: boolean }, ctx: ProjectContext) => {
    if (!ctx.codegenEnabled) {
      throw new Error(`Codegen is disabled: ${ctx.codegenReason}`)
    }

    const { valid, missing } = collectContracts(ctx)

    if (args.dryRun) {
      return {
        dryRun: true,
        wouldGenerate: valid.map((c) => c.contractName),
        skippedMissingAbi: missing,
        targetPath: ctx.config.targetPath,
        isSdk: Boolean(ctx.config.isSdk),
        isModule: Boolean(ctx.config.isModule),
        agentsFile: ctx.config.agentsFile ?? true,
      }
    }

    if (!valid.length) {
      return {
        ok: false,
        wrote: [],
        skippedMissingAbi: missing,
        message:
          'No contracts with embedded ABIs — nothing regenerated. Contracts that need Etherscan fetching must go through the `dappql` CLI.',
      }
    }

    createContractsCollection(
      valid,
      ctx.config.targetPath,
      ctx.config.isModule,
      ctx.config.isSdk,
      ctx.root,
    )

    const agents = createAgentsFile(valid, {
      targetPath: ctx.config.targetPath,
      isModule: ctx.config.isModule,
      isSdk: ctx.config.isSdk,
      chainId: ctx.chainId,
      agentsFile: ctx.config.agentsFile,
      rootDir: ctx.root,
    })

    return {
      ok: true,
      regenerated: valid.map((c) => c.contractName),
      skippedMissingAbi: missing,
      targetPath: ctx.config.targetPath,
      agents: agents
        ? { path: agents.path, mode: agents.mode }
        : { path: null, mode: 'skipped', reason: 'agentsFile: false' },
    }
  },
}
