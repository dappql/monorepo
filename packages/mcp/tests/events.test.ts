import { describe, expect, it, vi } from 'vitest'

const getLogsMock = vi.fn()
const getTransactionMock = vi.fn()
const getTransactionReceiptMock = vi.fn()

vi.mock('../src/clients.js', () => ({
  createPublic: () => ({
    getLogs: getLogsMock,
    getTransaction: getTransactionMock,
    getTransactionReceipt: getTransactionReceiptMock,
  }),
  createWallet: () => {
    throw new Error('wallet not needed in these tests')
  },
}))

import { getEventsTool, getTransactionTool } from '../src/tools/chain.js'
import type { ProjectContext } from '../src/types.js'

const tokenAbi = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const

function makeCtx(overrides: Partial<ProjectContext> = {}): ProjectContext {
  return {
    root: '/tmp',
    configPath: '/tmp/dapp.config.js',
    config: {
      targetPath: './contracts',
      contracts: {
        Token: {
          address: '0x1111111111111111111111111111111111111111',
          abi: tokenAbi as any,
        },
      },
    },
    rpcUrl: 'https://rpc.example',
    writesEnabled: false,
    writesReason: 'disabled',
    codegenEnabled: false,
    codegenReason: 'disabled',
    chainId: 8453,
    ...overrides,
  }
}

describe('getEventsTool', () => {
  it('has a stable tool shape', () => {
    expect(getEventsTool.name).toBe('getEvents')
    expect(getEventsTool.inputSchema).toMatchObject({
      required: ['contract', 'event'],
    })
  })

  it('resolves address from config, calls getLogs, returns decoded events with stringified bigints', async () => {
    getLogsMock.mockReset()
    getLogsMock.mockResolvedValueOnce([
      {
        blockNumber: 100n,
        transactionHash: '0xabc',
        logIndex: 0,
        args: { from: '0xaaa', to: '0xbbb', value: 1000n },
      },
      {
        blockNumber: 101n,
        transactionHash: '0xdef',
        logIndex: 2,
        args: { from: '0xccc', to: '0xddd', value: 2000n },
      },
    ])

    const result = (await getEventsTool.handler(
      { contract: 'Token', event: 'Transfer' },
      makeCtx(),
    )) as any

    const getLogsArgs = getLogsMock.mock.calls[0][0]
    expect(getLogsArgs.address).toBe('0x1111111111111111111111111111111111111111')
    expect(getLogsArgs.event).toMatchObject({ type: 'event', name: 'Transfer' })
    expect(getLogsArgs.fromBlock).toBe('earliest')
    expect(getLogsArgs.toBlock).toBe('latest')

    expect(result.total).toBe(2)
    expect(result.returned).toBe(2)
    expect(result.truncated).toBe(false)
    expect(result.events[0]).toEqual({
      blockNumber: '100',
      txHash: '0xabc',
      logIndex: 0,
      args: { from: '0xaaa', to: '0xbbb', value: '1000' },
    })
  })

  it('reports truncation when the log count exceeds limit', async () => {
    getLogsMock.mockReset()
    getLogsMock.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        blockNumber: BigInt(i),
        transactionHash: `0x${i}`,
        logIndex: i,
        args: { from: '0xaaa', to: '0xbbb', value: BigInt(i) },
      })),
    )

    const result = (await getEventsTool.handler(
      { contract: 'Token', event: 'Transfer', limit: 2 },
      makeCtx(),
    )) as any

    expect(result.total).toBe(5)
    expect(result.returned).toBe(2)
    expect(result.truncated).toBe(true)
  })

  it('parses block parameters (tags and numeric)', async () => {
    getLogsMock.mockReset()
    getLogsMock.mockResolvedValueOnce([])

    await getEventsTool.handler(
      { contract: 'Token', event: 'Transfer', fromBlock: '44000000', toBlock: 'latest' },
      makeCtx(),
    )

    const call = getLogsMock.mock.calls[0][0]
    expect(call.fromBlock).toBe(44000000n)
    expect(call.toBlock).toBe('latest')
  })

  it('throws on unknown event', async () => {
    await expect(
      getEventsTool.handler({ contract: 'Token', event: 'NotAnEvent' }, makeCtx()),
    ).rejects.toThrow(/Event not found/)
  })
})

describe('getTransactionTool', () => {
  it('has a stable tool shape', () => {
    expect(getTransactionTool.name).toBe('getTransaction')
    expect(getTransactionTool.inputSchema).toMatchObject({ required: ['hash'] })
  })

  it('returns gas, status, decoded input against a known to-address, and decoded logs', async () => {
    getTransactionMock.mockReset()
    getTransactionReceiptMock.mockReset()

    // transfer(0xaaa...aaa, 1000)
    // Function selector for transfer(address,uint256) = 0xa9059cbb
    // + 32-byte padded address + 32-byte uint
    const transferInput =
      '0xa9059cbb' +
      '000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' +
      '00000000000000000000000000000000000000000000000000000000000003e8'

    getTransactionMock.mockResolvedValueOnce({
      hash: '0xtx',
      from: '0xsender',
      to: '0x1111111111111111111111111111111111111111',
      value: 0n,
      gasPrice: 1_000_000_000n,
      input: transferInput,
    })

    // keccak256("Transfer(address,address,uint256)")
    const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

    getTransactionReceiptMock.mockResolvedValueOnce({
      status: 'success',
      blockNumber: 44_000_000n,
      blockHash: '0xblock',
      transactionIndex: 7,
      gasUsed: 50_000n,
      effectiveGasPrice: 1_100_000_000n,
      logs: [
        {
          address: '0x1111111111111111111111111111111111111111',
          logIndex: 0,
          topics: [
            transferTopic,
            '0x000000000000000000000000ffffffffffffffffffffffffffffffffffffffff',
            '0x000000000000000000000000aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          ],
          data: '0x00000000000000000000000000000000000000000000000000000000000003e8',
        },
      ],
    })

    const result = (await getTransactionTool.handler({ hash: '0xtx' }, makeCtx())) as any

    expect(result.gasUsed).toBe('50000')
    expect(result.status).toBe('success')
    expect(result.blockNumber).toBe('44000000')
    expect(result.decodedInput).toMatchObject({
      contract: 'Token',
      method: 'transfer',
    })
    expect(result.logs[0].decoded).toMatchObject({
      contract: 'Token',
      eventName: 'Transfer',
    })
    expect(result.logs[0].decoded.args.value).toBe('1000')
  })
})
