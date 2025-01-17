import { describe, it, expect, vi, beforeEach } from 'vitest'
import { singleQuery } from '../src'
import { query, iteratorQuery } from '../src'
import { multicall } from 'viem/actions'

const REQUEST_BALANCE = {
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

// Add to mock section at the top
vi.mock('viem/actions', () => ({
  multicall: vi.fn(),
}))

describe('Query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('async query', () => {
    it('executes multicall and returns formatted results', async () => {
      const mockClient = {} as any

      // Setup multicall mock
      ;(multicall as any).mockResolvedValue([{ result: 100n }, { result: 200n }])

      const result = await query(mockClient, {
        balance1: REQUEST_BALANCE,
        balance2: { ...REQUEST_BALANCE, args: ['0x789'] },
      })

      // Verify results are properly formatted
      expect(result).toEqual({
        balance1: 100n,
        balance2: 200n,
      })

      // Verify multicall was called with correct parameters
      expect(multicall).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          contracts: [
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: REQUEST_BALANCE.args,
            },
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['0x789'],
            },
          ],
        }),
      )
    })

    it('singleQuery returns unwrapped data', async () => {
      const mockClient = {} as any
      const result = await singleQuery(mockClient, REQUEST_BALANCE)
      expect(result).toBe(100n)
    })

    it('throws error if multicall fails', async () => {
      const mockClient = {} as any
      const mockError = new Error('Multicall failed')

      // Setup multicall mock to reject with the error
      ;(multicall as any).mockRejectedValue(mockError)

      await expect(query(mockClient, { balance: REQUEST_BALANCE })).rejects.toThrow(mockError)
    })

    it('throws error if multicall returns result with error', async () => {
      const mockClient = {} as any
      const mockError = new Error('Multicall failed')

      // Setup multicall mock to return a result with an error
      ;(multicall as any).mockResolvedValue([{ error: mockError }])

      await expect(query(mockClient, { balance: REQUEST_BALANCE })).rejects.toThrow(mockError.message)
    })
  })

  describe('async iteratorQuery', () => {
    beforeEach(() => {
      vi.clearAllMocks()
    })

    it('fetches multiple indexed items', async () => {
      const mockClient = {} as any

      // Setup multicall mock
      ;(multicall as any).mockResolvedValue([{ result: 100n }, { result: 200n }, { result: 300n }])

      const getItem = (index: bigint) => ({
        ...REQUEST_BALANCE,
        args: [index.toString()],
        defaultValue: 0n,
      })

      const result = await iteratorQuery(mockClient, 3n, getItem)

      // Verify results are properly formatted
      expect(result).toEqual([
        { value: 100n, queryIndex: 0n },
        { value: 200n, queryIndex: 1n },
        { value: 300n, queryIndex: 2n },
      ])

      // Verify multicall was called with correct parameters
      expect(multicall).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          contracts: [
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['0'],
            },
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['1'],
            },
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['2'],
            },
          ],
        }),
      )
    })

    it('handles empty total', async () => {
      const mockClient = {} as any
      const getItem = (index: bigint) => ({
        ...REQUEST_BALANCE,
        args: [index.toString()],
        defaultValue: 0n,
      })

      // Clear any previous calls
      vi.clearAllMocks()

      const result = await iteratorQuery(
        mockClient,
        0n, // total of 0 items
        getItem,
      )

      expect(result).toEqual([])
      // Since total is 0, multicall should not be called
      expect(multicall).not.toHaveBeenCalled()
    })

    it('respects firstIndex parameter', async () => {
      const mockClient = {} as any

      // Setup multicall mock
      ;(multicall as any).mockResolvedValue([{ result: 100n }, { result: 200n }])

      const getItem = (index: bigint) => ({
        ...REQUEST_BALANCE,
        args: [index.toString()],
        defaultValue: 0n,
      })

      const result = await iteratorQuery(mockClient, 2n, getItem, { firstIndex: 5n })

      // Verify results start from the correct index
      expect(result).toEqual([
        { value: 100n, queryIndex: 5n },
        { value: 200n, queryIndex: 6n },
      ])

      // Verify multicall was called with correct parameters
      expect(multicall).toHaveBeenCalledWith(
        mockClient,
        expect.objectContaining({
          contracts: [
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['5'],
            },
            {
              address: REQUEST_BALANCE.address,
              abi: REQUEST_BALANCE.getAbi(),
              functionName: REQUEST_BALANCE.method,
              args: ['6'],
            },
          ],
        }),
      )
    })
  })
})
