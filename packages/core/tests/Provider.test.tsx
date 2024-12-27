import * as React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { ADDRESS_RESOLVER_ERROR, DappQLProvider, useDappQL } from '../src/Provider'
import { createConfig } from 'wagmi'
import { http } from 'viem'
import { mainnet } from 'viem/chains'

// Mock config for testing
const mockConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

describe('DappQLProvider', () => {
  it('provides default context values', async () => {
    try {
      const { result } = renderHook(() => useDappQL(), {
        wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
      })

      expect(result.current.blocksRefetchInterval).toBe(1)
      expect(result.current.defaultBatchSize).toBe(1024)
      expect(result.current.watchBlocks).toBeUndefined()
      expect(typeof result.current.onBlockChange).toBe('function')
    } catch (error) {
      console.error('Error in default context test:', error)
      throw error
    }
  })

  it('accepts custom props', async () => {
    const { result } = renderHook(() => useDappQL(), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} blocksRefetchInterval={5} defaultBatchSize={2048} watchBlocks={true}>
          {children}
        </DappQLProvider>
      ),
    })

    expect(result.current.blocksRefetchInterval).toBe(5)
    expect(result.current.defaultBatchSize).toBe(2048)
    expect(result.current.watchBlocks).toBe(true)
  })

  it('handles address resolver component', async () => {
    let resolverCalled = false

    const mockResolver = vi.fn((contractName: string) => '0x123' as `0x${string}`)

    const AddressResolver = ({ onResolved }: { onResolved: (resolver: typeof mockResolver) => void }) => {
      React.useEffect(() => {
        onResolved(mockResolver)
        resolverCalled = true
      }, [])

      return null
    }

    const { result } = renderHook(() => useDappQL(), {
      wrapper: ({ children }) => {
        return (
          <DappQLProvider config={mockConfig} AddressResolverComponent={AddressResolver}>
            {children}
          </DappQLProvider>
        )
      },
    })

    // Wait for the effect to run
    await vi.waitFor(
      () => {
        expect(resolverCalled).toBe(true)
        expect(result.current.addressResolver).toBe(mockResolver)
      },
      {
        timeout: 1000,
        interval: 50,
      },
    )
  })

  it('handles direct address resolver prop', async () => {
    const mockResolver = vi.fn((contractName: string) => '0x123' as `0x${string}`)

    const { result } = renderHook(() => useDappQL(), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} addressResolver={mockResolver}>
          {children}
        </DappQLProvider>
      ),
    })

    expect(result.current.addressResolver).toBe(mockResolver)
  })

  it('handles mutation updates', async () => {
    const mockMutationUpdate = vi.fn()

    const { result } = renderHook(() => useDappQL(), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    expect(typeof result.current.onMutationUpdate).toBe('function')
  })

  it('waits for address resolver before rendering children', async () => {
    vi.useFakeTimers() // Enable fake timers at start of test

    let resolverCalled = false
    const mockResolver = vi.fn((contractName: string) => '0x123' as `0x${string}`)
    const TestChild = vi.fn(() => null)

    const AddressResolver = ({ onResolved }: { onResolved: (resolver: typeof mockResolver) => void }) => {
      React.useEffect(() => {
        // Simulate async resolution with consistent timing
        const timeoutId = setTimeout(() => {
          onResolved(mockResolver)
          resolverCalled = true
        }, 100)
        return () => clearTimeout(timeoutId)
      }, [])
      return null
    }

    renderHook(() => useDappQL(), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} AddressResolverComponent={AddressResolver}>
          <TestChild />
        </DappQLProvider>
      ),
    })

    // Child should not be rendered initially
    expect(TestChild).not.toHaveBeenCalled()

    // Advance timers and handle all pending updates
    await act(async () => {
      vi.advanceTimersByTime(100)
    })

    // Verify the resolver was called and child rendered
    expect(resolverCalled).toBe(true)
    expect(TestChild).toHaveBeenCalled()

    vi.useRealTimers() // Cleanup: restore real timers
  })

  it('handles block subscription changes', async () => {
    const { result } = renderHook(() => useDappQL(), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} watchBlocks={true}>
          {children}
        </DappQLProvider>
      ),
    })

    const unsubscribe = result.current.onBlockChange(() => {})
    expect(typeof unsubscribe).toBe('function')
    unsubscribe()
  })

  it('throws error when both resolver types are provided', () => {
    const directResolver = vi.fn((contractName: string) => '0x456' as `0x${string}`)
    const componentResolver = vi.fn((contractName: string) => '0x123' as `0x${string}`)

    const AddressResolver = ({ onResolved }: { onResolved: (resolver: typeof componentResolver) => void }) => {
      React.useEffect(() => {
        onResolved(componentResolver)
      }, [])
      return null
    }

    // Suppress React error boundary warning for this test
    const consoleSpy = vi.spyOn(console, 'error')
    consoleSpy.mockImplementation(() => {})

    expect(() => {
      renderHook(() => useDappQL(), {
        wrapper: ({ children }) => (
          // @ts-expect-error - Testing runtime error when TypeScript check is bypassed
          <DappQLProvider
            config={mockConfig}
            addressResolver={directResolver}
            AddressResolverComponent={AddressResolver}>
            {children}
          </DappQLProvider>
        ),
      })
    }).toThrow(ADDRESS_RESOLVER_ERROR)

    // Restore console.error
    consoleSpy.mockRestore()
  })
})
