import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { regenerateTool } from '../src/tools/codegen.js'
import type { ProjectContext } from '../src/types.js'

const tokenAbi = [
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
]

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    root: '/tmp',
    configPath: '/tmp/dapp.config.js',
    config: {
      targetPath: './contracts',
      contracts: {
        Token: { address: '0x1111111111111111111111111111111111111111', abi: tokenAbi as any },
      },
    },
    rpcUrl: 'https://rpc.example',
    writesEnabled: false,
    writesReason: 'disabled',
    codegenEnabled: false,
    codegenReason: 'codegen disabled',
    ...overrides,
  }
}

describe('regenerateTool', () => {
  let tmp: string

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'dappql-regen-')))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('throws when codegen is disabled', async () => {
    const ctx = makeCtx({ codegenEnabled: false, codegenReason: 'allowCodegen missing' })
    await expect(regenerateTool.handler({}, ctx)).rejects.toThrow(/allowCodegen missing/)
  })

  it('dryRun reports what would be generated without writing', async () => {
    const ctx = makeCtx({ root: tmp, codegenEnabled: true, codegenReason: 'ok' })
    const result = (await regenerateTool.handler({ dryRun: true }, ctx)) as {
      dryRun: boolean
      wouldGenerate: string[]
      targetPath: string
    }

    expect(result.dryRun).toBe(true)
    expect(result.wouldGenerate).toEqual(['Token'])
    expect(result.targetPath).toBe('./contracts')
    // Nothing written
    expect(existsSync(join(tmp, 'contracts'))).toBe(false)
    expect(existsSync(join(tmp, 'AGENTS.md'))).toBe(false)
  })

  it('writes typed modules and AGENTS.md into rootDir when enabled', async () => {
    const ctx = makeCtx({ root: tmp, codegenEnabled: true, codegenReason: 'ok' })
    const result = (await regenerateTool.handler({}, ctx)) as {
      ok: boolean
      regenerated: string[]
      agents: { path: string; mode: string }
    }

    expect(result.ok).toBe(true)
    expect(result.regenerated).toEqual(['Token'])

    // Contract module written
    const contractsDir = join(tmp, 'contracts')
    expect(existsSync(join(contractsDir, 'Token.ts'))).toBe(true)
    expect(existsSync(join(contractsDir, 'index.ts'))).toBe(true)

    // Contract module imports reasonable things + has the expected call factory
    const tokenSource = readFileSync(join(contractsDir, 'Token.ts'), 'utf8')
    expect(tokenSource).toContain('export const abi')
    expect(tokenSource).toContain('export const deployAddress')
    expect(tokenSource).toContain("totalSupply: (...args")

    // AGENTS.md written at root
    expect(existsSync(join(tmp, 'AGENTS.md'))).toBe(true)
    expect(result.agents.mode).toBe('created')
    expect(result.agents.path).toBe(join(tmp, 'AGENTS.md'))
  })

  it('reports contracts skipped due to missing ABI', async () => {
    const ctx = makeCtx({
      root: tmp,
      codegenEnabled: true,
      codegenReason: 'ok',
      config: {
        targetPath: './contracts',
        contracts: {
          Token: { address: '0x1111111111111111111111111111111111111111', abi: tokenAbi as any },
          Mystery: { address: '0x2222222222222222222222222222222222222222' }, // no abi
        },
      },
    })

    const result = (await regenerateTool.handler({}, ctx)) as {
      regenerated: string[]
      skippedMissingAbi: string[]
    }

    expect(result.regenerated).toEqual(['Token'])
    expect(result.skippedMissingAbi).toEqual(['Mystery'])
  })
})
