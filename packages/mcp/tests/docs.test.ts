import { describe, expect, it } from 'vitest'

import { getDappqlReferenceTool, listContractsTool } from '../src/tools/metadata.js'
import type { ProjectContext } from '../src/types.js'

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    root: '/tmp',
    configPath: '/tmp/dapp.config.js',
    config: {
      targetPath: './contracts',
      contracts: {
        Token: {
          address: '0x1111111111111111111111111111111111111111',
          abi: [
            {
              type: 'function',
              name: 'totalSupply',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ name: '', type: 'uint256' }],
            },
          ] as any,
        },
      },
    },
    rpcUrl: 'https://rpc.example',
    writesEnabled: false,
    writesReason: 'disabled',
    codegenEnabled: false,
    codegenReason: 'disabled',
    chainId: 8453,
    ...overrides,
  }
}

describe('getDappqlReferenceTool', () => {
  it('has a stable tool shape', () => {
    expect(getDappqlReferenceTool.name).toBe('getDappqlReference')
    expect(getDappqlReferenceTool.description).toMatch(/library reference/i)
  })

  it('returns markdown content', async () => {
    const result = (await getDappqlReferenceTool.handler({}, makeCtx())) as {
      format: string
      bundled: boolean
      content: string
    }
    expect(result.format).toBe('markdown')
    expect(typeof result.content).toBe('string')
    // Either the real bundled content (long) or the fallback pointer — both non-trivial.
    expect(result.content.length).toBeGreaterThan(100)
    expect(result.content).toMatch(/DappQL/)
  })

  it('covers the key failure-mode topics when bundled', async () => {
    const result = (await getDappqlReferenceTool.handler({}, makeCtx())) as {
      bundled: boolean
      content: string
    }
    if (!result.bundled) return // skip if running against fallback only
    expect(result.content).toMatch(/\.at\(/)
    expect(result.content).toMatch(/useContextQuery/)
    expect(result.content).toMatch(/addressResolver/)
  })
})

describe('listContractsTool — agent hint', () => {
  it('includes a hint pointing at getDappqlReference and the library resource', async () => {
    const result = (await listContractsTool.handler({}, makeCtx())) as { hint?: string }
    expect(result.hint).toBeDefined()
    expect(result.hint).toMatch(/getDappqlReference|dappql:\/\/docs\/library/)
  })
})
