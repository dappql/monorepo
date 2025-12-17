import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BlockSubscriptionManager, useBlockNumberSubscriber } from '../src/blocksHandler'
import { renderHook } from '@testing-library/react'
import { usePublicClient } from 'wagmi'

// Mock wagmi's usePublicClient hook
vi.mock('wagmi', () => ({
  usePublicClient: vi.fn(),
}))

describe('BlockSubscriptionManager', () => {
  let manager: BlockSubscriptionManager

  beforeEach(() => {
    manager = new BlockSubscriptionManager()
  })

  it('does not call callback immediately when no real block exists', () => {
    const callback = vi.fn()
    const unsubscribe = manager.subscribe(callback)

    // Should NOT be called immediately (no real block yet)
    expect(callback).not.toHaveBeenCalled()

    // Cleanup
    unsubscribe()
  })

  it('calls callback immediately if a real block exists', () => {
    const callback = vi.fn()

    // First, update to a real block
    manager.onBlockUpdated(100n)

    // Now subscribe
    const unsubscribe = manager.subscribe(callback)

    // Should be called immediately with current block
    expect(callback).toHaveBeenCalledWith(100n)
    expect(callback).toHaveBeenCalledTimes(1)

    // Cleanup
    unsubscribe()
  })

  it('notifies subscribers of block updates', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    // Subscribe two different callbacks
    const unsubscribe1 = manager.subscribe(callback1)
    const unsubscribe2 = manager.subscribe(callback2)

    // Update block number
    manager.onBlockUpdated(123n)

    // Both callbacks should receive the update
    expect(callback1).toHaveBeenCalledWith(123n)
    expect(callback2).toHaveBeenCalledWith(123n)

    // Cleanup
    unsubscribe1()
    unsubscribe2()
  })

  it('allows unsubscribing', () => {
    const callback = vi.fn()
    const unsubscribe = manager.subscribe(callback)

    // Clear initial call
    callback.mockClear()

    // Unsubscribe
    unsubscribe()

    // Update block
    manager.onBlockUpdated(456n)

    // Callback should not be called after unsubscribe
    expect(callback).not.toHaveBeenCalled()
  })

  it('maintains separate subscribers', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    // Subscribe first callback
    const unsubscribe1 = manager.subscribe(callback1)

    // Clear initial calls
    callback1.mockClear()

    // Subscribe second callback
    const unsubscribe2 = manager.subscribe(callback2)

    // Update block
    manager.onBlockUpdated(789n)

    // Both should be called
    expect(callback1).toHaveBeenCalledWith(789n)
    expect(callback2).toHaveBeenCalledWith(789n)

    // Unsubscribe first callback
    unsubscribe1()

    // Update block again
    manager.onBlockUpdated(1000n)

    // Only second callback should receive the update
    expect(callback1).not.toHaveBeenCalledWith(1000n)
    expect(callback2).toHaveBeenCalledWith(1000n)

    // Cleanup
    unsubscribe2()
  })

  it('handles multiple block updates', () => {
    const callback = vi.fn()
    const unsubscribe = manager.subscribe(callback)

    // Clear initial call
    callback.mockClear()

    // Multiple updates
    manager.onBlockUpdated(1n)
    manager.onBlockUpdated(2n)
    manager.onBlockUpdated(3n)

    expect(callback).toHaveBeenCalledTimes(3)
    expect(callback).toHaveBeenNthCalledWith(1, 1n)
    expect(callback).toHaveBeenNthCalledWith(2, 2n)
    expect(callback).toHaveBeenNthCalledWith(3, 3n)

    // Cleanup
    unsubscribe()
  })
})

describe('useBlockNumberSubscriber', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a subscription function', () => {
    const mockUnwatch = vi.fn()
    const mockWatchBlockNumber = vi.fn(() => mockUnwatch)

    const mockClient = {
      watchBlockNumber: mockWatchBlockNumber,
    }
    ;(usePublicClient as any).mockReturnValue(mockClient)

    const { result } = renderHook(() => useBlockNumberSubscriber())

    expect(typeof result.current).toBe('function')
  })

  it('watches for block updates and cleans up', () => {
    const mockUnwatch = vi.fn()
    const mockWatchBlockNumber = vi.fn(() => mockUnwatch)

    const mockClient = {
      watchBlockNumber: mockWatchBlockNumber,
    }
    ;(usePublicClient as any).mockReturnValue(mockClient)

    const { unmount } = renderHook(() => useBlockNumberSubscriber())

    expect(mockWatchBlockNumber).toHaveBeenCalled()
    // @ts-expect-error - Testing runtime error when TypeScript check is bypassed
    expect(typeof mockWatchBlockNumber.mock.calls[0][0].onBlockNumber).toBe('function')

    unmount()
    expect(mockUnwatch).toHaveBeenCalled()
  })

  it('notifies subscribers of block updates', async () => {
    let onBlockNumberCallback: ((blockNumber: bigint) => void) | undefined
    const mockUnwatch = vi.fn()
    const mockWatchBlockNumber = vi.fn(({ onBlockNumber }) => {
      onBlockNumberCallback = onBlockNumber
      return mockUnwatch
    })

    const mockClient = {
      watchBlockNumber: mockWatchBlockNumber,
    }
    ;(usePublicClient as any).mockReturnValue(mockClient)

    const { result } = renderHook(() => useBlockNumberSubscriber())

    const callback = vi.fn()
    const unsubscribe = result.current(callback)

    // Should NOT be called initially (no real block yet)
    expect(callback).not.toHaveBeenCalled()

    // Block update
    if (onBlockNumberCallback) {
      onBlockNumberCallback(123n)
    }
    expect(callback).toHaveBeenCalledWith(123n)

    // Unsubscribe
    unsubscribe()
    if (onBlockNumberCallback) {
      onBlockNumberCallback(456n)
    }
    expect(callback).not.toHaveBeenCalledWith(456n)
  })

  it('handles missing public client', () => {
    ;(usePublicClient as any).mockReturnValue(null)

    const { result } = renderHook(() => useBlockNumberSubscriber())

    const callback = vi.fn()
    const unsubscribe = result.current(callback)

    // Should NOT be called (no client, no real block)
    expect(callback).not.toHaveBeenCalled()
    expect(() => unsubscribe()).not.toThrow()
  })
})
