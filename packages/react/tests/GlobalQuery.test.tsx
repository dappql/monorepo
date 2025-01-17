import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useContextQuery, useIteratorContextQuery, useSingleContextQuery } from '../src/ContextQuery'
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

describe('useContextQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the complete query lifecycle', async () => {
    let mockResult = {
      data: undefined as any,
      isLoading: true,
    }

    // Mock useReadContracts with a function that returns current mockResult
    const mockUseReadContracts = vi.fn(() => mockResult)
    ;(useReadContracts as any).mockImplementation(mockUseReadContracts)

    const { result, rerender } = renderHook(
      () =>
        useContextQuery({
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
    await act(async () => {
      mockResult = {
        data: [{ result: 123n }],
        isLoading: false,
      }
      // Force a re-render by updating the mock implementation
      mockUseReadContracts.mockImplementation(() => mockResult)
      ;(useReadContracts as any).mockImplementation(mockUseReadContracts)
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
})

describe('useSingleContextQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the complete query lifecycle', async () => {
    let mockResult = {
      data: undefined as any,
      isLoading: true,
    }

    // Mock useReadContracts with a function that returns current mockResult
    const mockUseReadContracts = vi.fn(() => mockResult)
    ;(useReadContracts as any).mockImplementation(mockUseReadContracts)

    const { result, rerender } = renderHook(() => useSingleContextQuery(REQUEST_BALANCE), {
      wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
    })

    // Initial state should show default value and loading
    expect(result.current.data).toBe(0n)
    expect(result.current.isLoading).toBe(true)

    // Update mock state with correct data shape
    await act(async () => {
      mockResult = {
        data: [{ result: 123n }],
        isLoading: false,
      }
      // Force a re-render by updating the mock implementation
      mockUseReadContracts.mockImplementation(() => mockResult)
      ;(useReadContracts as any).mockImplementation(mockUseReadContracts)
    })

    rerender()

    // Wait for the changes to be reflected
    await waitFor(
      () => {
        expect(result.current.data).toBe(123n)
        expect(result.current.isLoading).toBe(false)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })
})

describe('useIteratorContextQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('follows the complete query lifecycle', async () => {
    let mockResult = {
      data: undefined as any,
      isLoading: true,
    }

    // Mock useReadContracts with a function that returns current mockResult
    const mockUseReadContracts = vi.fn(() => mockResult)
    ;(useReadContracts as any).mockImplementation(mockUseReadContracts)

    const { result, rerender } = renderHook(() => useIteratorContextQuery(2n, () => REQUEST_BALANCE, 1n), {
      wrapper: ({ children }) => <DappQLProvider>{children}</DappQLProvider>,
    })

    // Initial state should show default value and loading
    expect(result.current.data[0]).toBe(undefined)
    expect(result.current.isLoading).toBe(true)

    // Update mock state with correct data shape
    await act(async () => {
      mockResult = {
        data: [{ result: 123n }, { result: 456n }],
        isLoading: false,
      }
      // Force a re-render by updating the mock implementation
      mockUseReadContracts.mockImplementation(() => mockResult)
      ;(useReadContracts as any).mockImplementation(mockUseReadContracts)
    })

    rerender()

    // Wait for the changes to be reflected
    await waitFor(
      () => {
        expect(result.current.data[0]).toStrictEqual({ queryIndex: 1n, value: 123n })
        expect(result.current.data[1]).toStrictEqual({ queryIndex: 2n, value: 456n })
        expect(result.current.isLoading).toBe(false)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })
})
