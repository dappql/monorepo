import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useQuery, useSingleQuery, useIteratorQuery } from '../src/Query'
import { DappQLProvider } from '../src/Provider'
import * as React from 'react'
import { useReadContracts } from 'wagmi'
import { useBlockNumberSubscriber } from '../src/blocksHandler'

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
    // Store all callbacks to notify all subscribers
    const callbacks: Array<(block: bigint) => void> = []
    ;(useBlockNumberSubscriber as any).callbacks = callbacks
    ;(useBlockNumberSubscriber as any).triggerBlock = (block: bigint) => {
      callbacks.forEach((cb) => cb(block))
    }
    return vi.fn((callback) => {
      callbacks.push(callback)
      // Also store last for backwards compatibility
      ;(useBlockNumberSubscriber as any).lastCallback = callback
      return vi.fn() // Return unsubscribe function
    })
  }),
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
        wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
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
      wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
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
      wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
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
      wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
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
        wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
      },
    )

    expect(result.current.data.balance).toBe(100n)

    // Simulate block update by triggering all subscribers
    act(() => {
      ;(useBlockNumberSubscriber as any).triggerBlock(123n)
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
    const { result } = renderHook(
      () =>
        useQuery(
          {
            balance: REQUEST_BALANCE,
          },
          { watchBlocks: false },
        ),
      {
        wrapper: ({ children }) => <DappQLProvider watchBlocks>{children}</DappQLProvider>,
      },
    )

    expect(result.current.data.balance).toBe(100n)

    // Simulate block update by triggering all subscribers
    act(() => {
      ;(useBlockNumberSubscriber as any).triggerBlock(123n)
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
        wrapper: ({ children }) => <DappQLProvider watchBlocks={false}>{children}</DappQLProvider>,
      },
    )

    // Simulate block update
    act(() => {
      ;(useBlockNumberSubscriber as any).triggerBlock(123n)
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
        wrapper: ({ children }) => <DappQLProvider watchBlocks>{children}</DappQLProvider>,
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
