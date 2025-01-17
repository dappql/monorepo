import { ContextQueryManager } from '../src/ContextQueryManager.js'
import { describe, it, expect, vi } from 'vitest'
import { Abi } from 'viem'
import { Request } from '../src/types.js'

describe('ContextQueryManager', () => {
  const mockAbi = {} as Abi
  const createMockRequest = (method: string, args: any[] = []): Request => ({
    method,
    args,
    getAbi: () => mockAbi,
    deployAddress: '0x123',
    contractName: 'test',
    defaultValue: null,
  })

  it('should aggregate single query', () => {
    const onUpdate = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    const queryId = manager.addQuery({
      collection: {
        balance: createMockRequest('balanceOf', ['0x123']),
      },
      callBack: vi.fn(),
    })

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        calls: [
          expect.objectContaining({
            queryId,
            functionName: 'balanceOf',
            args: ['0x123'],
          }),
        ],
      }),
    )
  })

  it('should handle rapid query changes', () => {
    const onUpdate = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    // Add first query
    const query1Id = manager.addQuery({
      collection: {
        balance1: createMockRequest('balanceOf', ['0x123']),
      },
      callBack: vi.fn(),
    })

    // Immediately add second query
    const query2Id = manager.addQuery({
      collection: {
        balance2: createMockRequest('balanceOf', ['0x456']),
      },
      callBack: vi.fn(),
    })

    // Last call should have both queries
    const lastCall = onUpdate.mock.lastCall?.[0]
    expect(lastCall.calls).toHaveLength(2)
    expect(lastCall.calls[0].queryId).toBe(query1Id)
    expect(lastCall.calls[1].queryId).toBe(query2Id)
  })

  it('should only process results matching current version', () => {
    const onUpdate = vi.fn()
    const callback = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    manager.addQuery({
      collection: {
        balance: createMockRequest('balanceOf', ['0x123']),
      },
      callBack: callback,
    })

    const lastQuery = onUpdate.mock.lastCall?.[0]

    // Process result with wrong version
    manager.onResult(
      {
        isLoading: false,
        data: [{ result: '100', status: 'success' }],
      },
      lastQuery.version + 1,
    )

    expect(callback).not.toHaveBeenCalled()

    // Process result with correct version
    manager.onResult(
      {
        isLoading: false,
        data: [{ result: '100', status: 'success' }],
      },
      lastQuery.version,
    )

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ result: '100', status: 'success' }],
      }),
    )
  })
})

describe('QueryManager - Racing Conditions', () => {
  const mockAbi = {} as Abi
  const createMockRequest = (method: string, args: any[] = []): Request => ({
    method,
    args,
    getAbi: () => mockAbi,
    deployAddress: '0x123',
    contractName: 'test',
    defaultValue: null,
  })

  it('should ignore results from outdated queries', () => {
    const onUpdate = vi.fn()
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    // First query
    manager.addQuery({
      collection: { query1: createMockRequest('method1') },
      callBack: callback1,
    })
    const version1 = onUpdate.mock.lastCall?.[0].version
    expect(version1).toBe(1)
    expect(manager.getVersion()).toBe(1)
    expect(manager.getContextQuery().calls.length).toBe(1)
    expect(manager.getContextQuery().version).toBe(1)

    // Second query (replaces first)
    manager.addQuery({
      collection: { query2: createMockRequest('method2') },
      callBack: callback2,
    })
    const version2 = onUpdate.mock.lastCall?.[0].version
    expect(version2).toBe(2)
    expect(manager.getVersion()).toBe(2)
    expect(manager.getContextQuery().calls.length).toBe(2)
    expect(manager.getContextQuery().version).toBe(2)

    // Process results in wrong order
    manager.onResult(
      {
        isLoading: false,
        data: [
          { result: 'new1', status: 'success' },
          { result: 'new2', status: 'success' },
        ],
      },
      version2,
    )

    manager.onResult(
      {
        isLoading: false,
        data: [{ result: 'old', status: 'success' }],
      },
      version1,
    )

    expect(callback1).toHaveBeenCalledWith({
      isLoading: false,
      isError: undefined,
      error: undefined,
      data: [{ result: 'new1', status: 'success' }],
    })
    expect(callback2).toHaveBeenCalledWith({
      isLoading: false,
      isError: undefined,
      error: undefined,
      data: [{ result: 'new2', status: 'success' }],
    })
  })

  it('should batch rapid updates', () => {
    const onUpdate = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    // Queue multiple updates synchronously
    Promise.all([
      manager.addQuery({
        collection: { query1: createMockRequest('method1') },
        callBack: vi.fn(),
      }),
      manager.addQuery({
        collection: { query2: createMockRequest('method2') },
        callBack: vi.fn(),
      }),
      manager.addQuery({
        collection: { query3: createMockRequest('method3') },
        callBack: vi.fn(),
      }),
    ])

    // Last update should contain all queries
    const lastCall = onUpdate.mock.lastCall?.[0]
    expect(lastCall?.calls).toHaveLength(3)
  })

  it('should handle query removal during results processing', () => {
    const onUpdate = vi.fn()
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const manager = new ContextQueryManager(onUpdate)

    // First query
    const query1Id = manager.addQuery({
      collection: { query1: createMockRequest('method1') },
      callBack: callback1,
    })
    const version1 = onUpdate.mock.lastCall?.[0].version
    expect(version1).toBe(1)

    // Second query
    const query2Id = manager.addQuery({
      collection: { query2: createMockRequest('method2') },
      callBack: callback2,
    })
    const version2 = onUpdate.mock.lastCall?.[0].version
    expect(version2).toBe(2)

    // Process results for version2
    manager.onResult(
      {
        isLoading: false,
        data: [
          { result: 'new1', status: 'success' },
          { result: 'new2', status: 'success' },
        ],
      },
      version2,
    )

    // Remove first query
    manager.removeQuery(query1Id)
    const version3 = onUpdate.mock.lastCall?.[0].version
    expect(version3).toBe(3)
    expect(manager.getContextQuery().calls.length).toBe(1)

    // Process new results
    manager.onResult(
      {
        isLoading: false,
        data: [{ result: 'final', status: 'success' }],
      },
      version3,
    )

    // First callback should not receive the final update
    expect(callback1).toHaveBeenCalledTimes(1)
    expect(callback1).toHaveBeenLastCalledWith({
      isLoading: false,
      isError: undefined,
      error: undefined,
      data: [{ result: 'new1', status: 'success' }],
    })

    // Second callback should receive both updates
    expect(callback2).toHaveBeenCalledTimes(2)
    expect(callback2).toHaveBeenLastCalledWith({
      isLoading: false,
      isError: undefined,
      error: undefined,
      data: [{ result: 'final', status: 'success' }],
    })
  })
})
