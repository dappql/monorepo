import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useTransactionUpdates, { MutationInfo } from '../src/useTransactionUpdates'
import { usePublicClient } from 'wagmi'
import { type Address } from 'viem'

// Mock localStorage
const mockLocalStorage = (() => {
  let store: { [key: string]: string } = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
})

// Mock window event listeners
const mockListeners: { [key: string]: ((e: any) => void)[] } = {}
const mockAddEventListener = vi.fn((event: string, cb: (e: any) => void) => {
  mockListeners[event] = mockListeners[event] || []
  mockListeners[event].push(cb)
})
const mockRemoveEventListener = vi.fn((event: string, cb: (e: any) => void) => {
  mockListeners[event] = (mockListeners[event] || []).filter((listener) => listener !== cb)
})

Object.defineProperty(window, 'addEventListener', {
  value: mockAddEventListener,
})
Object.defineProperty(window, 'removeEventListener', {
  value: mockRemoveEventListener,
})

describe('useTransactionUpdates', () => {
  const mockClient = {
    waitForTransactionReceipt: vi.fn(),
  }

  const mockOnUpdate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.clear()
    ;(usePublicClient as any).mockReturnValue(mockClient)
    vi.useFakeTimers() // Setup fake timers
  })

  afterEach(() => {
    // Cleanup any remaining listeners
    Object.keys(mockListeners).forEach((event) => {
      mockListeners[event] = []
    })
    vi.useRealTimers() // Restore real timers
  })

  const createMockMutation = (status: MutationInfo['status'], txHash?: Address): MutationInfo => ({
    id: '123',
    status,
    address: '0x123' as Address,
    contractName: 'TestContract',
    functionName: 'test',
    account: '0x456' as Address,
    txHash: txHash as Address,
    transactionName: 'Test Transaction',
  })

  it('initializes and cleans up correctly', () => {
    const { unmount } = renderHook(() => useTransactionUpdates(mockOnUpdate))

    expect(mockAddEventListener).toHaveBeenCalledWith('storage', expect.any(Function))

    unmount()

    expect(mockRemoveEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
  })

  it('processes existing transactions on init', () => {
    const existingTx = createMockMutation('signed', '0xabc')
    mockLocalStorage.setItem('pending-transactions', JSON.stringify([JSON.stringify(existingTx)]))

    mockClient.waitForTransactionReceipt.mockResolvedValue({ status: 'success' })

    renderHook(() => useTransactionUpdates(mockOnUpdate))

    expect(mockClient.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: '0xabc',
    })
  })

  it('handles new transaction updates', async () => {
    const { result } = renderHook(() => useTransactionUpdates(mockOnUpdate))
    const mutation = createMockMutation('signed', '0xabc')

    // Setup promise resolution
    const receiptPromise = Promise.resolve({ status: 'success' })
    mockClient.waitForTransactionReceipt.mockReturnValue(receiptPromise)

    // Simulate new transaction
    act(() => {
      result.current(mutation)
    })

    // Verify localStorage update
    expect(mockLocalStorage.setItem).toHaveBeenCalledWith('pending-transactions', expect.stringContaining('0xabc'))

    // Wait for promise to resolve
    await act(async () => {
      await receiptPromise
    })

    // Verify onUpdate was called with success
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        txHash: '0xabc',
      }),
    )
  })

  it('handles failed transactions', async () => {
    const { result } = renderHook(() => useTransactionUpdates(mockOnUpdate))
    const mutation = createMockMutation('signed', '0xabc')

    // Setup promise resolution
    const receiptPromise = Promise.resolve({ status: 'reverted' })
    mockClient.waitForTransactionReceipt.mockReturnValue(receiptPromise)

    // Simulate new transaction
    act(() => {
      result.current(mutation)
    })

    // Wait for promise to resolve
    await act(async () => {
      await receiptPromise
    })

    // Verify onUpdate was called with error
    expect(mockOnUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: expect.any(Error),
        txHash: '0xabc',
      }),
    )
  })

  it('handles storage events from other tabs', () => {
    renderHook(() => useTransactionUpdates(mockOnUpdate))

    const newTx = createMockMutation('signed', '0xabc')

    // Simulate storage event from another tab
    act(() => {
      const storageEvent = new StorageEvent('storage', {
        key: 'pending-transactions',
        newValue: JSON.stringify([JSON.stringify(newTx)]),
      })
      mockListeners.storage.forEach((listener) => listener(storageEvent))
    })

    expect(mockClient.waitForTransactionReceipt).toHaveBeenCalledWith({
      hash: '0xabc',
    })
  })

  it('cleans up aborted transactions', async () => {
    const { result, unmount } = renderHook(() => useTransactionUpdates(mockOnUpdate))
    const mutation = createMockMutation('signed', '0xabc')

    // Setup a promise that won't resolve immediately
    const receiptPromise = new Promise(() => {}) // Never resolves
    mockClient.waitForTransactionReceipt.mockReturnValue(receiptPromise)

    // Start watching transaction
    act(() => {
      result.current(mutation)
    })

    // Unmount before transaction completes
    unmount()

    // Verify cleanup
    expect(mockRemoveEventListener).toHaveBeenCalledWith('storage', expect.any(Function))
    // The transaction watching should be aborted
    expect(mockOnUpdate).not.toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
      }),
    )
  })

  it('handles errors during transaction watching', async () => {
    const { result } = renderHook(() => useTransactionUpdates(mockOnUpdate))
    const mutation = createMockMutation('signed', '0xabc')
    const mockError = new Error('Network error')

    // Mock console.error to prevent error from being logged
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Setup promise rejection
    mockClient.waitForTransactionReceipt.mockRejectedValue(mockError)

    // Simulate new transaction
    act(() => {
      result.current(mutation)
    })

    // Wait for promise rejection
    await act(async () => {
      try {
        await mockClient.waitForTransactionReceipt()
      } catch (e) {
        // Expected rejection
      }
    })

    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining(`Error watching transaction ${mutation.txHash}:`),
      mockError,
    )

    // Cleanup
    consoleSpy.mockRestore()
  })

  it('ignores errors from aborted transactions', async () => {
    const { result, unmount } = renderHook(() => useTransactionUpdates(mockOnUpdate))
    const mutation = createMockMutation('signed', '0xabc')

    // Mock console.error to verify it's not called
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // Setup a promise that will reject after unmount
    let rejectFn: (error: Error) => void
    const receiptPromise = new Promise((_, reject) => {
      rejectFn = reject
    })
    mockClient.waitForTransactionReceipt.mockReturnValue(receiptPromise)

    // Start watching transaction
    act(() => {
      result.current(mutation)
    })

    // Unmount to trigger cleanup
    unmount()

    // Now reject the promise
    await act(async () => {
      rejectFn!(new Error('Network error'))
      try {
        await receiptPromise
      } catch (e) {
        // Expected rejection
      }
    })

    // Verify error was not logged because transaction was aborted
    expect(consoleSpy).not.toHaveBeenCalled()

    // Cleanup
    consoleSpy.mockRestore()
  })
})
