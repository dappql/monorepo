import { vi } from 'vitest'
import { createConfig } from 'wagmi'
import { http } from 'viem'
import { mainnet } from 'viem/chains'

// Create mock config once
export const mockConfig = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
})

// Mock public client with required methods
export const mockPublicClient = {
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: 'success' }),
  watchBlockNumber: vi.fn(),
  simulateContract: vi.fn(),
}

// Setup global wagmi mocks
vi.mock('wagmi', async () => {
  const actual = await vi.importActual('wagmi')
  return {
    ...actual,
    useConfig: vi.fn(() => mockConfig),
    useAccount: vi.fn(() => ({
      address: '0x456',
      chain: { id: 1 },
    })),
    usePublicClient: vi.fn(() => mockPublicClient),
    useWaitForTransactionReceipt: vi.fn(),
    useWriteContract: vi.fn(),
    useReadContracts: vi.fn(() => ({ refetch: vi.fn() })),
  }
})
