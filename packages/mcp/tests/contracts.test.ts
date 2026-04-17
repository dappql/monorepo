import { describe, expect, it } from 'vitest'

import { findAbiFunction, getContractAddress, summarizeContract } from '../src/contracts.js'

const tokenAbi = [
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint256' }] },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
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
  { type: 'event', name: 'Transfer', inputs: [] },
] as const

describe('summarizeContract', () => {
  it('splits reads, writes, and events', () => {
    const s = summarizeContract('Token', {
      abi: tokenAbi as any,
      address: '0x1111111111111111111111111111111111111111',
    })
    expect(s.shape).toBe('singleton')
    expect(s.reads.map((r) => r.name).sort()).toEqual(['balanceOf', 'totalSupply'])
    expect(s.writes.map((w) => w.name)).toEqual(['transfer'])
    expect(s.events.map((e) => e.name)).toEqual(['Transfer'])
  })

  it('labels template contracts', () => {
    const s = summarizeContract('Vault', { abi: tokenAbi as any, isTemplate: true })
    expect(s.shape).toBe('template')
    expect(s.address).toBeNull()
  })
})

describe('getContractAddress', () => {
  const config = {
    targetPath: './contracts',
    contracts: {
      Token: { address: '0x1111111111111111111111111111111111111111' as `0x${string}`, abi: tokenAbi as any },
      Wallet: { isTemplate: true, abi: tokenAbi as any },
    },
  }

  it('returns singleton address from config', () => {
    expect(getContractAddress(config as any, 'Token')).toBe('0x1111111111111111111111111111111111111111')
  })

  it('requires an override for template contracts', () => {
    expect(() => getContractAddress(config as any, 'Wallet')).toThrow(/template/)
  })

  it('accepts an override', () => {
    expect(
      getContractAddress(config as any, 'Wallet', '0x2222222222222222222222222222222222222222'),
    ).toBe('0x2222222222222222222222222222222222222222')
  })
})

describe('findAbiFunction', () => {
  it('finds by name', () => {
    const fn = findAbiFunction(tokenAbi as any, 'balanceOf')
    expect(fn.name).toBe('balanceOf')
  })

  it('throws on unknown method', () => {
    expect(() => findAbiFunction(tokenAbi as any, 'doesNotExist')).toThrow(/not found/)
  })
})
