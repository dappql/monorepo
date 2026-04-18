import { describe, expect, it } from 'vitest'

import { listResources, readResource } from '../src/resources.js'
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

describe('resources', () => {
  it('lists core resources including dappql://docs/library', () => {
    const resources = listResources(makeCtx())
    const uris = resources.map((r) => r.uri)
    expect(uris).toContain('dappql://project/config')
    expect(uris).toContain('dappql://contracts/Token')
    expect(uris).toContain('dappql://docs/library')
  })

  it('readResource on docs/library returns non-empty markdown', () => {
    const { mimeType, text } = readResource('dappql://docs/library', makeCtx())
    expect(mimeType).toBe('text/markdown')
    // If the library-reference.md asset is bundled, expect the real content.
    // If not (e.g. someone forgot prebuild), we fall back to a pointer message.
    // Either way, `text` must be non-trivial markdown.
    expect(text.length).toBeGreaterThan(100)
    expect(text).toMatch(/DappQL/)
  })

  it('readResource on project config returns JSON with contract names', () => {
    const { mimeType, text } = readResource('dappql://project/config', makeCtx())
    expect(mimeType).toBe('application/json')
    const body = JSON.parse(text)
    expect(body.contracts).toEqual(['Token'])
    expect(body.chainId).toBe(8453)
  })

  it('readResource on an unknown URI throws', () => {
    expect(() => readResource('dappql://nope/nope', makeCtx())).toThrow(/Unknown resource/)
  })
})
