import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useQuery, useSingleQuery, useIteratorQuery } from '../src/Query'
import { DappQLProvider } from '../src/Provider'
import { createConfig } from 'wagmi'
import { http } from 'viem'
import { mainnet } from 'viem/chains'
import * as React from 'react'
import { useReadContracts } from 'wagmi'
import { useBlockNumberSubscriber } from '../src/blocksHandler'
import { query, iteratorQuery } from '../src/Query'
import { multicall } from 'viem/actions'

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useReadContracts: vi.fn(),
  }
})

// Mock config for testing
const mockConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

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

// Add to mock section
vi.mock('../src/blocksHandler.js', () => ({
  useBlockNumberSubscriber: vi.fn(() => {
    return vi.fn((callback) => {
      // Store the callback for testing
      ;(useBlockNumberSubscriber as any).lastCallback = callback
      return vi.fn() // Return unsubscribe function
    })
  }),
}))

// Add to mock section at the top
vi.mock('viem/actions', () => ({
  multicall: vi.fn(),
}))

describe('useQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the complete query lifecycle', async () => {
    // Create a ref to hold our mock state
    const mockState = {
      data: undefined,
      isLoading: true,
      error: null,
      status: 'loading',
      refetch: vi.fn(),
    }

    // Setup the mock
    ;(useReadContracts as any).mockImplementation(() => mockState)

    const { result, rerender } = renderHook(
      () =>
        useQuery({
          balance: REQUEST_BALANCE,
        }),
      {
        wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
      },
    )

    // Initial state should show default value and loading
    expect(result.current.data.balance).toBe(0n)
    expect(result.current.isLoading).toBe(true)

    // Update mock state with correct data shape
    act(() => {
      Object.assign(mockState, {
        data: [{ result: 123n }],
        isLoading: false,
        status: 'success',
      })
    })

    rerender()

    // Wait for the changes to be reflected
    await waitFor(
      () => {
        expect(result.current.data.balance).toBe(123n)
        expect(result.current.isLoading).toBe(false)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })

  it('useSingleQuery returns unwrapped data', async () => {
    // Create a ref to hold our mock state
    const mockState = {
      data: undefined,
      isLoading: true,
      error: null,
      status: 'loading',
      refetch: vi.fn(),
    }

    // Setup the mock
    ;(useReadContracts as any).mockImplementation(() => mockState)

    const { result, rerender } = renderHook(() => useSingleQuery(REQUEST_BALANCE), {
      wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
    })

    // Initial state should show default value and loading
    expect(result.current.data).toBe(0n) // Note: data is unwrapped
    expect(result.current.isLoading).toBe(true)

    // Update mock state with correct data shape
    act(() => {
      Object.assign(mockState, {
        data: [{ result: 123n }],
        isLoading: false,
        status: 'success',
      })
    })

    rerender()

    // Wait for the changes to be reflected
    await waitFor(
      () => {
        expect(result.current.data).toBe(123n) // Note: data is unwrapped
        expect(result.current.isLoading).toBe(false)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })

  it('useIteratorQuery fetches multiple indexed items', async () => {
    // Create a ref to hold our mock state
    const mockState = {
      data: undefined,
      isLoading: true,
      error: null,
      status: 'loading',
      refetch: vi.fn(),
    }

    // Setup the mock
    ;(useReadContracts as any).mockImplementation(() => mockState)

    // Create a function that generates requests for each index
    const getItem = (index: bigint) => ({
      ...REQUEST_BALANCE,
      args: [index.toString()],
      defaultValue: 0n,
    })

    const { result, rerender } = renderHook(() => useIteratorQuery(3n, getItem), {
      wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
    })

    // Initial state should show empty array and loading
    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(true)

    // Update mock state with results for all three items
    act(() => {
      Object.assign(mockState, {
        data: [{ result: 100n }, { result: 200n }, { result: 300n }],
        isLoading: false,
        status: 'success',
      })
    })

    rerender()

    // Wait for the changes to be reflected
    await waitFor(
      () => {
        expect(result.current.data).toEqual([
          { value: 100n, queryIndex: 0n },
          { value: 200n, queryIndex: 1n },
          { value: 300n, queryIndex: 2n },
        ])
        expect(result.current.isLoading).toBe(false)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })

  it('useIteratorQuery handles empty total', () => {
    const getItem = (index: bigint) => ({
      ...REQUEST_BALANCE,
      args: [index.toString()],
      defaultValue: 0n,
    })

    const { result } = renderHook(() => useIteratorQuery(0n, getItem), {
      wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
    })

    // Should return empty array immediately without loading
    expect(result.current.data).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('refetches data on block changes when watchBlocks is true', async () => {
    // Setup read contracts mock
    const mockState = {
      data: [{ result: 100n }],
      isLoading: false,
      error: null,
      status: 'success',
      refetch: vi.fn(),
    }
    ;(useReadContracts as any).mockImplementation(() => mockState)

    // Render hook with watchBlocks enabled
    const { result, rerender } = renderHook(
      () =>
        useQuery(
          {
            balance: REQUEST_BALANCE,
          },
          { watchBlocks: true },
        ),
      {
        wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
      },
    )

    expect(result.current.data.balance).toBe(100n)

    // Simulate block update by calling the stored callback
    act(() => {
      const blockCallback = (useBlockNumberSubscriber as any).lastCallback
      blockCallback(123n)
    })

    // Verify refetch was called
    await waitFor(() => {
      expect(mockState.refetch).toHaveBeenCalled()
    })
  })

  it('should not refetch when watchBlocks is false even if Provider is set to watchBlocks', async () => {
    // Setup read contracts mock
    const mockState = {
      data: [{ result: 100n }],
      isLoading: false,
      error: null,
      status: 'success',
      refetch: vi.fn(),
    }
    ;(useReadContracts as any).mockImplementation(() => mockState)

    // Render hook with watchBlocks enabled
    const { result, rerender } = renderHook(
      () =>
        useQuery(
          {
            balance: REQUEST_BALANCE,
          },
          { watchBlocks: false },
        ),
      {
        wrapper: ({ children }) => (
          <DappQLProvider config={mockConfig} watchBlocks>
            {children}
          </DappQLProvider>
        ),
      },
    )

    expect(result.current.data.balance).toBe(100n)

    // Simulate block update by calling the stored callback
    act(() => {
      const blockCallback = (useBlockNumberSubscriber as any).lastCallback
      blockCallback(123n)
    })

    // Verify refetch was called
    await waitFor(() => {
      expect(mockState.refetch).not.toHaveBeenCalled()
    })
  })

  it('does not refetch when watchBlocks is false', async () => {
    const mockState = {
      data: [{ result: 100n }],
      isLoading: false,
      error: null,
      status: 'success',
      refetch: vi.fn(),
    }
    ;(useReadContracts as any).mockImplementation(() => mockState)

    // Render hook with watchBlocks disabled
    renderHook(
      () =>
        useQuery({
          balance: REQUEST_BALANCE,
        }),
      {
        wrapper: ({ children }) => (
          <DappQLProvider config={mockConfig} watchBlocks={false}>
            {children}
          </DappQLProvider>
        ),
      },
    )

    // Simulate block update
    act(() => {
      const blockCallback = (useBlockNumberSubscriber as any).lastCallback
      blockCallback(123n)
    })

    // Verify refetch was not called
    expect(mockState.refetch).not.toHaveBeenCalled()
  })

  it('preserves previous data when refetch results in error', async () => {
    // Setup initial mock state with successful data
    const mockState = {
      data: [{ result: 100n }],
      isLoading: false,
      error: null,
      status: 'success',
      refetch: vi.fn(),
    }
    ;(useReadContracts as any).mockImplementation(() => mockState)

    // Render hook with watchBlocks enabled
    const { result, rerender } = renderHook(
      () =>
        useQuery(
          {
            balance: REQUEST_BALANCE,
          },
          { watchBlocks: true },
        ),
      {
        wrapper: ({ children }) => (
          <DappQLProvider config={mockConfig} watchBlocks>
            {children}
          </DappQLProvider>
        ),
      },
    )

    // Verify initial successful state
    expect(result.current.data.balance).toBe(100n)
    expect(result.current.error).toBeNull()

    // Update mock to simulate error on refetch
    act(() => {
      Object.assign(mockState, {
        data: undefined,
        error: new Error('Failed to fetch'),
        status: 'error',
      })
    })

    rerender()

    // Verify that the previous data is preserved despite the error
    await waitFor(() => {
      expect(result.current.data.balance).toBe(100n) // Data should be preserved
      expect(result.current.error).not.toBeNull() // Error should be present
    })
  })
})

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
