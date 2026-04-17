import { describe, it, expect, vi, beforeEach } from 'vitest'

import { queryWithStatus } from '../src'
import { multicall } from 'viem/actions'

vi.mock('viem/actions', () => ({
  multicall: vi.fn(),
}))

const REQUEST = {
  address: '0x123' as `0x${string}`,
  method: 'balanceOf',
  args: ['0x456'],
  defaultValue: 0n,
  getAbi: () =>
    [
      {
        type: 'function',
        name: 'balanceOf',
        inputs: [{ type: 'address' }],
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
      },
    ] as const,
  contractName: 'TestContract',
}

describe('queryWithStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns ok=true entries when all calls succeed', async () => {
    const mockClient = {} as any
    ;(multicall as any).mockResolvedValue([{ result: 100n }, { result: 200n }])

    const result = await queryWithStatus(mockClient, {
      a: REQUEST,
      b: { ...REQUEST, args: ['0x789'] },
    })

    expect(result.a).toEqual({ ok: true, result: 100n })
    expect(result.b).toEqual({ ok: true, result: 200n })
  })

  it('returns ok=false with the error for failed calls — does NOT throw', async () => {
    const mockClient = {} as any
    const err = new Error('reverted: balance too low')
    ;(multicall as any).mockResolvedValue([{ result: 100n }, { error: err }])

    const result = await queryWithStatus(mockClient, {
      good: REQUEST,
      bad: { ...REQUEST, args: ['0xdead'] },
    })

    expect(result.good).toEqual({ ok: true, result: 100n })
    expect(result.bad).toEqual({ ok: false, error: err })
  })

  it('forwards blockNumber to viem multicall', async () => {
    const mockClient = {} as any
    ;(multicall as any).mockResolvedValue([{ result: 1n }])

    await queryWithStatus(mockClient, { x: REQUEST }, { blockNumber: 12345n })

    expect(multicall).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ blockNumber: 12345n, allowFailure: true }),
    )
  })

  it('uses addressResolver when request has no explicit address', async () => {
    const mockClient = {} as any
    ;(multicall as any).mockResolvedValue([{ result: 42n }])

    const { address: _addr, ...noAddress } = REQUEST
    await queryWithStatus(
      mockClient,
      { x: noAddress as any },
      {},
      (name) => (name === 'TestContract' ? '0xresolved' : '0x0'),
    )

    expect(multicall).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        contracts: [expect.objectContaining({ address: '0xresolved' })],
      }),
    )
  })
})
