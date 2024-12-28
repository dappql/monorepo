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
    usePublicClient: vi.fn(),
    useWaitForTransactionReceipt: vi.fn(),
    useWriteContract: vi.fn(),
    useReadContracts: vi.fn(),
  }
})
