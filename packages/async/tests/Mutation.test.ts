import { describe, it, expect, vi } from 'vitest'
import { createWalletClient, http, parseAbi } from 'viem'
import { mutate } from '../src'
import { localhost } from 'viem/chains'

describe('mutate', () => {
  // Setup mock wallet client
  const mockClient = createWalletClient({
    chain: localhost,
    transport: http(),
    account: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
  })

  // Mock contract ABI
  const mockAbi = parseAbi(['function transfer(address to, uint256 amount) returns (bool)'])

  // Mock mutation config
  const mockMutation = {
    contractName: 'TestToken',
    deployAddress: '0x1234567890123456789012345678901234567890',
    getAbi: () => mockAbi,
    functionName: 'transfer',
  } as const

  it('should create a mutation function with direct address', () => {
    // Mock writeContract
    mockClient.writeContract = vi.fn().mockResolvedValue('0xhash')

    const mutation = mutate(mockClient, mockMutation)

    // The returned function is async, but mutate itself is not
    void mutation('0xrecipient', 100n)

    expect(mockClient.writeContract).toHaveBeenCalledWith({
      address: mockMutation.deployAddress,
      abi: mockAbi,
      functionName: 'transfer',
      args: ['0xrecipient', 100n],
      chain: localhost,
      account: mockClient.account,
    })
  })

  it('should use provided address over deployAddress', () => {
    const customAddress = '0x9876543210987654321098765432109876543210'
    mockClient.writeContract = vi.fn().mockResolvedValue('0xhash')

    const mutation = mutate(mockClient, mockMutation, {
      address: customAddress,
    })
    void mutation('0xrecipient', 100n)

    expect(mockClient.writeContract).toHaveBeenCalledWith({
      address: customAddress,
      abi: mockAbi,
      functionName: 'transfer',
      args: ['0xrecipient', 100n],
      chain: localhost,
      account: mockClient.account,
    })
  })

  it('should use address resolver if provided', () => {
    const resolvedAddress = '0xaabbccddaabbccddaabbccddaabbccddaabbccdd'
    const addressResolver = vi.fn().mockReturnValue(resolvedAddress)
    mockClient.writeContract = vi.fn().mockResolvedValue('0xhash')

    const mutation = mutate(mockClient, mockMutation, {
      addressResolver,
    })
    void mutation('0xrecipient', 100n)

    expect(addressResolver).toHaveBeenCalledWith('TestToken')
    expect(mockClient.writeContract).toHaveBeenCalledWith({
      address: resolvedAddress,
      abi: mockAbi,
      functionName: 'transfer',
      args: ['0xrecipient', 100n],
      chain: localhost,
      account: mockClient.account,
    })
  })

  it('should throw if client has no account', () => {
    const clientWithoutAccount = createWalletClient({
      chain: localhost,
      transport: http(),
    })

    expect(() => mutate(clientWithoutAccount, mockMutation)).toThrow()
  })
})
