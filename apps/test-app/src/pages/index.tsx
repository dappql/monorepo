import { useDappQL } from '@dappql/core'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

import { calls, useIteratorQuery, useMutation, useQuery } from '~/contracts/collection'

const STATUSES = {
  1: 'Pending',
  2: 'Doing',
  4: 'Done',
}

export default function Home() {
  const { address = '0x0' } = useAccount()
  const { currentBlock } = useDappQL()

  const result = useQuery({
    total: calls.ToDo('numItems', [address], { defaultValue: BigInt(0) }),
  })

  const items = useIteratorQuery(result.data.total, (index: bigint) => calls.ToDo('item', [address, index]), {
    firstIndex: BigInt(1),
  })

  const addItem = useMutation('ToDo', 'addItem')
  const updateItem = useMutation('ToDo', 'updateStatus')

  return (
    <div>
      <ConnectButton label="Sign in" />
      <hr />
      <div>Current Block: {currentBlock.toString()}</div>
      <div>Total Items (dappql): {result.data.total?.toString()}</div>
      <hr />

      {items.data.map((i) => {
        const status = STATUSES[Number(i.value.status) as keyof typeof STATUSES]

        return (
          <div key={i.queryIndex.toString()}>
            <div>ID: {i.queryIndex.toString()}</div>
            <div>Content: {i.value.content}</div>
            <div>Created at: {new Date(Number(i.value.timestamp) * 1000).toLocaleString()}</div>
            <div>Updated at: {new Date(Number(i.value.lastUpdated) * 1000).toLocaleString()}</div>
            <div>Status: {status}</div>
            {status === 'Done' ? null : (
              <button
                onClick={() => {
                  if (status === 'Pending') {
                    updateItem.send(i.queryIndex, BigInt(2))
                  } else {
                    updateItem.send(i.queryIndex, BigInt(4))
                  }
                }}>
                Update Status
              </button>
            )}
            <hr />
          </div>
        )
      })}

      <button onClick={() => addItem.send('Test', BigInt(1))}>Create Item</button>
    </div>
  )
}
