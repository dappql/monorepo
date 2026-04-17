import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/clients.js', () => ({
  createPublic: () => ({
    getBlock: async () => ({
      number: 44834573n,
      hash: '0xaaa',
      timestamp: 1744902900n,
    }),
    getGasPrice: async () => 1_500_000_000n,
  }),
}))

import { chainStateTool } from '../src/tools/metadata.js'
import type { ProjectContext } from '../src/types.js'

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    root: '/tmp',
    configPath: '/tmp/dapp.config.js',
    config: { targetPath: './contracts', contracts: {} },
    rpcUrl: 'https://rpc.example',
    writesEnabled: false,
    writesReason: 'disabled',
    codegenEnabled: false,
    codegenReason: 'disabled',
    chainId: 8453,
    ...overrides,
  }
}

describe('chainStateTool', () => {
  it('has a stable tool shape', () => {
    expect(chainStateTool.name).toBe('chainState')
    expect(chainStateTool.description).toMatch(/block number/i)
    expect(chainStateTool.inputSchema).toMatchObject({ type: 'object', additionalProperties: false })
  })

  it('returns stringified chain state with ISO timestamp', async () => {
    const result = (await chainStateTool.handler({}, makeCtx())) as Record<string, unknown>
    expect(result).toEqual({
      chainId: 8453,
      blockNumber: '44834573',
      blockHash: '0xaaa',
      blockTimestamp: '1744902900',
      blockTimestampISO: new Date(1744902900 * 1000).toISOString(),
      gasPrice: '1500000000',
    })
  })

  it('reports null chainId when unset', async () => {
    const result = (await chainStateTool.handler({}, makeCtx({ chainId: undefined }))) as { chainId: unknown }
    expect(result.chainId).toBe(null)
  })
})
