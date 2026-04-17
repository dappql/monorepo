import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import createAgentsFile from '../src/createAgentsFile.js'
import type { AbiFunction, AbiParameter } from '../src/types.js'

type Contract = { contractName: string; address?: `0x${string}`; abi?: AbiFunction[]; isTemplate?: boolean }

const viewFn = (name: string, inputs: AbiParameter[] = []): AbiFunction => ({
  type: 'function',
  name,
  stateMutability: 'view',
  inputs,
  outputs: [{ name: '', type: 'uint256' }],
})

const writeFn = (name: string, inputs: AbiParameter[] = []): AbiFunction => ({
  type: 'function',
  name,
  stateMutability: 'nonpayable',
  inputs,
  outputs: [],
})

const eventFn = (name: string): AbiFunction => ({
  type: 'event',
  name,
  inputs: [],
})

const token: Contract = {
  contractName: 'Token',
  address: '0x1111111111111111111111111111111111111111',
  abi: [
    viewFn('totalSupply'),
    viewFn('balanceOf', [{ name: 'owner', type: 'address' }]),
    writeFn('transfer', [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ]),
    eventFn('Transfer'),
  ],
}

const erc20Template: Contract = {
  contractName: 'ERC20',
  isTemplate: true,
  abi: [
    viewFn('balanceOf', [{ name: 'holder', type: 'address' }]),
    writeFn('approve', [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ]),
  ],
}

const readOnlyOracle: Contract = {
  contractName: 'Oracle',
  abi: [viewFn('getPrice', [{ name: 'asset', type: 'address' }])],
}

describe('createAgentsFile', () => {
  let tmp: string

  beforeEach(() => {
    tmp = realpathSync(mkdtempSync(join(tmpdir(), 'dappql-agents-')))
  })

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('creates AGENTS.md on first run with both markers', () => {
    const path = join(tmp, 'AGENTS.md')
    const result = createAgentsFile([token], { targetPath: './src/contracts', agentsFile: path })

    expect(result).toEqual({ written: true, path, mode: 'created' })
    expect(existsSync(path)).toBe(true)

    const contents = readFileSync(path, 'utf8')
    expect(contents).toContain('<!-- dappql:start -->')
    expect(contents).toContain('<!-- dappql:end -->')
    expect(contents).toContain('`Token`')
    expect(contents).toContain('| singleton |')
  })

  it('replaces only the managed block on re-run', () => {
    const path = join(tmp, 'AGENTS.md')
    const userPreamble = '# Project instructions\n\nMy own rules for the agent.\n'
    const userEpilogue = '\n## Notes\n\nPlease keep tests passing.\n'

    createAgentsFile([token], { targetPath: './src/contracts', agentsFile: path })
    const initial = readFileSync(path, 'utf8')
    writeFileSync(path, userPreamble + '\n' + initial + userEpilogue)

    const result = createAgentsFile([readOnlyOracle], { targetPath: './src/contracts', agentsFile: path })
    expect(result?.mode).toBe('updated')

    const after = readFileSync(path, 'utf8')
    expect(after).toContain('# Project instructions')
    expect(after).toContain('My own rules for the agent.')
    expect(after).toContain('Please keep tests passing.')
    expect(after).toContain('`Oracle`')
    expect(after).not.toContain('`Token`')
    expect(after.match(/dappql:start/g)?.length).toBe(1)
    expect(after.match(/dappql:end/g)?.length).toBe(1)
  })

  it('appends a managed block to an existing file without markers', () => {
    const path = join(tmp, 'AGENTS.md')
    writeFileSync(path, '# Existing agent doc\n\nLine A\n')

    const result = createAgentsFile([token], { targetPath: './src/contracts', agentsFile: path })
    expect(result?.mode).toBe('appended')

    const after = readFileSync(path, 'utf8')
    expect(after.startsWith('# Existing agent doc')).toBe(true)
    expect(after).toContain('<!-- dappql:start -->')
    expect(after).toContain('`Token`')
  })

  it('returns null and writes nothing when agentsFile is false', () => {
    const path = join(tmp, 'AGENTS.md')
    const result = createAgentsFile([token], { targetPath: './src/contracts', agentsFile: false })

    expect(result).toBeNull()
    expect(existsSync(path)).toBe(false)
  })

  it('writes to rootDir/AGENTS.md when rootDir is passed and agentsFile is omitted', () => {
    const result = createAgentsFile([token], { targetPath: './src/contracts', rootDir: tmp })

    expect(result?.mode).toBe('created')
    expect(result?.path).toBe(join(tmp, 'AGENTS.md'))
    expect(existsSync(join(tmp, 'AGENTS.md'))).toBe(true)
  })

  it('resolves a relative agentsFile path against rootDir when both are provided', () => {
    const result = createAgentsFile([token], {
      targetPath: './src/contracts',
      rootDir: tmp,
      agentsFile: './docs/AGENTS.md',
    })
    expect(result?.path).toBe(join(tmp, 'docs/AGENTS.md'))
  })

  it('renders arg placeholders using ABI input names', () => {
    const path = join(tmp, 'AGENTS.md')
    createAgentsFile([token], { targetPath: './src/contracts', agentsFile: path })

    const contents = readFileSync(path, 'utf8')
    expect(contents).toContain('Token.call.totalSupply()')
    expect(contents).toContain('tx.send(/* to, amount */)')
  })

  it('labels template contracts and emits the .at() example', () => {
    const path = join(tmp, 'AGENTS.md')
    createAgentsFile([erc20Template], { targetPath: './src/contracts', agentsFile: path })

    const contents = readFileSync(path, 'utf8')
    expect(contents).toMatch(/\| `ERC20` \| template \|/)
    expect(contents).toContain('.at(contractAddress)')
  })

  it('includes the SDK factory section only when isSdk is true', () => {
    const withoutSdk = join(tmp, 'no-sdk.md')
    createAgentsFile([token], { targetPath: './src/contracts', agentsFile: withoutSdk })
    expect(readFileSync(withoutSdk, 'utf8')).not.toContain('createSdk(')

    const withSdk = join(tmp, 'with-sdk.md')
    createAgentsFile([token, erc20Template], {
      targetPath: './src/contracts',
      isSdk: true,
      agentsFile: withSdk,
    })
    const contents = readFileSync(withSdk, 'utf8')
    expect(contents).toContain("import createSdk from './src/contracts/sdk'")
    expect(contents).toContain('SDK factory: yes')
  })

  it('handles a contract with no reads or writes without crashing', () => {
    const empty: Contract = { contractName: 'Empty', abi: [eventFn('Heartbeat')] }
    const path = join(tmp, 'AGENTS.md')
    const result = createAgentsFile([empty], { targetPath: './src/contracts', agentsFile: path })

    expect(result?.mode).toBe('created')
    const contents = readFileSync(path, 'utf8')
    expect(contents).toContain('`Empty`')
    expect(contents).toContain('`Heartbeat`')
    expect(contents).toMatch(/\| `Empty` \| singleton \| — \| — \| `Heartbeat` \|/)
  })

  it('is idempotent: running twice with the same inputs yields identical output', () => {
    const path = join(tmp, 'AGENTS.md')
    createAgentsFile([token, erc20Template], { targetPath: './src/contracts', agentsFile: path })
    const first = readFileSync(path, 'utf8')

    createAgentsFile([token, erc20Template], { targetPath: './src/contracts', agentsFile: path })
    const second = readFileSync(path, 'utf8')

    expect(second).toBe(first)
  })
})
