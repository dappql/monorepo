import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor, cleanup } from '@testing-library/react'
import { useMutation } from '../src/Mutation'
import { DappQLProvider } from '../src/Provider'
import { createConfig } from 'wagmi'
import { http } from 'viem'
import { mainnet } from 'viem/chains'
import * as React from 'react'
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from 'wagmi'

// Mock wagmi hooks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useAccount: vi.fn(),
    usePublicClient: vi.fn(),
    useWaitForTransactionReceipt: vi.fn(),
    useWriteContract: vi.fn(),
  }
})

// Mock blocksHandler
vi.mock('../src/blocksHandler.js', () => ({
  useBlockNumberSubscriber: vi.fn(() => vi.fn()),
  BlockSubscriptionManager: vi.fn(() => ({
    subscribe: vi.fn(),
    onBlockUptated: vi.fn(),
  })),
}))

// Mock config for testing
const mockConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

const MUTATION_CONFIG = {
  contractName: 'TestContract',
  functionName: 'setValue',
  deployAddress: '0x123' as `0x${string}`,
  getAbi: () =>
    [
      {
        type: 'function',
        name: 'setValue',
        inputs: [{ type: 'uint256' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ] as const,
}

describe('useMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Setup default mocks
    ;(useAccount as any).mockReturnValue({
      address: '0x456',
      chain: { id: 1 },
    })
    ;(usePublicClient as any).mockReturnValue({
      simulateContract: vi.fn(),
    })
    ;(useWaitForTransactionReceipt as any).mockReturnValue({
      isLoading: false,
      data: null,
    })
    ;(useWriteContract as any).mockReturnValue({
      writeContract: vi.fn(),
      data: null,
      isPending: false,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('initializes with correct default state', () => {
    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, 'Set Value'), {
      wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
    })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.send).toBeDefined()
  })

  it('handles transaction submission', async () => {
    const mockWriteContract = vi.fn()
    const mockOnMutationUpdate = vi.fn()
    ;(useWriteContract as any).mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, 'Set Value'), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockOnMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify writeContract was called with correct params
    expect(mockWriteContract).toHaveBeenCalledWith(
      {
        abi: MUTATION_CONFIG.getAbi(),
        functionName: MUTATION_CONFIG.functionName,
        address: MUTATION_CONFIG.deployAddress,
        args: [123n],
      },
      expect.any(Object),
    )

    // Verify onMutationUpdate was called with submitted status
    expect(mockOnMutationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'submitted',
        contractName: MUTATION_CONFIG.contractName,
        functionName: MUTATION_CONFIG.functionName,
        args: [123n],
      }),
    )
  })

  it('handles simulation when enabled', async () => {
    const mockSimulateContract = vi.fn().mockResolvedValue({})
    const mockWriteContract = vi.fn()
    ;(usePublicClient as any).mockReturnValue({
      simulateContract: mockSimulateContract,
    })
    ;(useWriteContract as any).mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, { simulate: true }), {
      wrapper: ({ children }) => <DappQLProvider config={mockConfig}>{children}</DappQLProvider>,
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify simulation was called
    expect(mockSimulateContract).toHaveBeenCalledWith({
      abi: MUTATION_CONFIG.getAbi(),
      functionName: MUTATION_CONFIG.functionName,
      address: MUTATION_CONFIG.deployAddress,
      args: [123n],
      account: '0x456',
    })

    // Wait for simulation and verify writeContract was called
    await waitFor(() => {
      expect(mockWriteContract).toHaveBeenCalled()
    })
  })

  it('handles errors when no account is connected', () => {
    const mockOnMutationUpdate = vi.fn()
    ;(useAccount as any).mockReturnValue({
      address: null,
      chain: { id: 1 },
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, 'Set Value'), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockOnMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify error was reported
    expect(mockOnMutationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: new Error('No account connected'),
      }),
    )
  })

  it('uses addressResolver when available', () => {
    const mockAddressResolver = vi.fn().mockReturnValue('0x789')
    const mockWriteContract = vi.fn()
    ;(useWriteContract as any).mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} addressResolver={mockAddressResolver}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify correct address was used
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: '0x789',
      }),
      expect.any(Object),
    )
  })

  it('handles transaction confirmation states', async () => {
    const mockOnMutationUpdate = vi.fn()
    const mockTxHash = '0xabc'

    // Mock write contract to return a tx hash
    ;(useWriteContract as any).mockReturnValue({
      writeContract: vi.fn((_, { onSettled }) => {
        onSettled(mockTxHash, null)
      }),
      data: mockTxHash,
      isPending: false,
    })

    // Mock confirmation states
    ;(useWaitForTransactionReceipt as any).mockReturnValue({
      isLoading: true,
      data: null,
    })

    const { result, rerender } = renderHook(() => useMutation(MUTATION_CONFIG, 'Set Value'), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockOnMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify signed status update
    expect(mockOnMutationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'signed',
        txHash: mockTxHash,
      }),
    )

    // Verify loading state
    expect(result.current.isLoading).toBe(true)

    // Mock confirmation complete
    ;(useWaitForTransactionReceipt as any).mockReturnValue({
      isLoading: false,
      data: { transactionHash: mockTxHash },
    })

    rerender()

    // Verify loading state updated
    expect(result.current.isLoading).toBe(false)
  })

  it('handles transaction errors in onSettled', async () => {
    const mockOnMutationUpdate = vi.fn()
    const mockError = new Error('Transaction failed')

    // Mock write contract to return an error
    ;(useWriteContract as any).mockReturnValue({
      writeContract: vi.fn((_, { onSettled }) => {
        onSettled(null, mockError)
      }),
      data: null,
      isPending: false,
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, 'Set Value'), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockOnMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify error status update
    expect(mockOnMutationUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: new Error(mockError.message),
      }),
    )
  })

  it('handles simulation errors', async () => {
    const mockOnMutationUpdate = vi.fn()
    const mockError = new Error('Simulation failed')
    const mockSimulateContract = vi.fn().mockRejectedValue(mockError)

    // Mock public client with failing simulation
    ;(usePublicClient as any).mockReturnValue({
      simulateContract: mockSimulateContract,
    })

    const { result } = renderHook(() => useMutation(MUTATION_CONFIG, { simulate: true }), {
      wrapper: ({ children }) => (
        <DappQLProvider config={mockConfig} onMutationUpdate={mockOnMutationUpdate}>
          {children}
        </DappQLProvider>
      ),
    })

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Wait for simulation to fail
    await waitFor(() => {
      expect(mockOnMutationUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error: new Error(mockError.message),
        }),
      )
    })

    // Verify writeContract was not called after simulation failure
    expect(useWriteContract().writeContract).not.toHaveBeenCalled()
  })

  it('uses address from mutation options when provided', () => {
    const mockWriteContract = vi.fn()
    const customAddress = '0xabc123' as `0x${string}`
    const mockAddressResolver = vi.fn().mockReturnValue('0x789')

    ;(useWriteContract as any).mockReturnValue({
      writeContract: mockWriteContract,
      data: null,
      isPending: false,
    })

    const { result } = renderHook(
      () =>
        useMutation(MUTATION_CONFIG, {
          address: customAddress,
          transactionName: 'Custom Address Test',
        }),
      {
        wrapper: ({ children }) => (
          <DappQLProvider config={mockConfig} addressResolver={mockAddressResolver}>
            {children}
          </DappQLProvider>
        ),
      },
    )

    // Trigger mutation
    act(() => {
      result.current.send(123n)
    })

    // Verify custom address was used instead of resolved or default address
    expect(mockWriteContract).toHaveBeenCalledWith(
      expect.objectContaining({
        address: customAddress,
      }),
      expect.any(Object),
    )

    // Verify address resolver was not called
    expect(mockAddressResolver).not.toHaveBeenCalled()
  })
})
