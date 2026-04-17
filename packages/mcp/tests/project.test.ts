import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { findConfigPath, loadProjectContext } from '../src/project.js'

function writeConfig(root: string, body: string) {
  writeFileSync(join(root, 'dapp.config.js'), body)
}

const MINIMAL = `export default {
  targetPath: './contracts',
  contracts: {
    Token: {
      address: '0x1111111111111111111111111111111111111111',
      abi: [{ type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] }],
    },
  },
}
`

describe('project detection', () => {
  let tmp: string
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'dappql-mcp-')))
    originalEnv = { ...process.env }
    delete process.env.DAPPQL_RPC_URL
    delete process.env.DAPPQL_PRIVATE_KEY
    delete process.env.MNEMONIC
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
    process.env = originalEnv
  })

  it('findConfigPath returns null when no config exists upwards', () => {
    expect(findConfigPath(tmp)).toBeNull()
  })

  it('findConfigPath walks up parent directories', () => {
    const nested = join(tmp, 'a', 'b', 'c')
    mkdirSync(nested, { recursive: true })
    writeConfig(tmp, MINIMAL)
    expect(findConfigPath(nested)).toBe(join(tmp, 'dapp.config.js'))
  })

  it('loadProjectContext requires an RPC — via env or mcp.rpc', async () => {
    writeConfig(tmp, MINIMAL)
    await expect(loadProjectContext(tmp)).rejects.toThrow(/No RPC URL configured/)

    process.env.DAPPQL_RPC_URL = 'https://env-rpc.example'
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.rpcUrl).toBe('https://env-rpc.example')
  })

  it('mcp.rpc in dapp.config.js overrides DAPPQL_RPC_URL env', async () => {
    process.env.DAPPQL_RPC_URL = 'https://env-rpc.example'
    writeConfig(
      tmp,
      `export default {
        targetPath: './contracts',
        contracts: {},
        mcp: { rpc: 'https://config-rpc.example' },
      }
      `,
    )
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.rpcUrl).toBe('https://config-rpc.example')
  })

  it('writes are disabled by default (no opt-in, no key)', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    writeConfig(tmp, MINIMAL)
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.writesEnabled).toBe(false)
    expect(ctx?.writesReason).toMatch(/not opted in/)
  })

  it('writes remain disabled with only the opt-in flag — missing key', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    writeConfig(
      tmp,
      `export default {
        targetPath: './contracts',
        contracts: {},
        mcp: { allowWrites: true },
      }
      `,
    )
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.writesEnabled).toBe(false)
    expect(ctx?.writesReason).toMatch(/DAPPQL_PRIVATE_KEY|MNEMONIC/)
  })

  it('writes remain disabled with only the key — missing opt-in', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    process.env.DAPPQL_PRIVATE_KEY = '0x' + '1'.repeat(64)
    writeConfig(tmp, MINIMAL)
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.writesEnabled).toBe(false)
    expect(ctx?.writesReason).toMatch(/allowWrites/)
  })

  it('writes enabled only when both gates pass', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    process.env.DAPPQL_PRIVATE_KEY = '0x' + '1'.repeat(64)
    writeConfig(
      tmp,
      `export default {
        targetPath: './contracts',
        contracts: {},
        mcp: { allowWrites: true },
      }
      `,
    )
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.writesEnabled).toBe(true)
  })

  it('codegen is disabled by default', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    writeConfig(tmp, MINIMAL)
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.codegenEnabled).toBe(false)
    expect(ctx?.codegenReason).toMatch(/allowCodegen/)
  })

  it('codegen enabled when mcp.allowCodegen is true', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    writeConfig(
      tmp,
      `export default {
        targetPath: './contracts',
        contracts: {},
        mcp: { allowCodegen: true },
      }
      `,
    )
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.codegenEnabled).toBe(true)
  })

  it('codegen and writes policies are independent', async () => {
    process.env.DAPPQL_RPC_URL = 'https://rpc.example'
    process.env.DAPPQL_PRIVATE_KEY = '0x' + '1'.repeat(64)
    writeConfig(
      tmp,
      `export default {
        targetPath: './contracts',
        contracts: {},
        mcp: { allowCodegen: true },
      }
      `,
    )
    const ctx = await loadProjectContext(tmp)
    expect(ctx?.codegenEnabled).toBe(true)
    expect(ctx?.writesEnabled).toBe(false) // allowWrites not set
  })
})
