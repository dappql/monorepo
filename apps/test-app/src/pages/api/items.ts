// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { iteratorQuery, singleQuery } from '@dappql/async'
import type { NextApiRequest, NextApiResponse } from 'next'
import { Address, createPublicClient, http, stringify } from 'viem'
import { sepolia } from 'viem/chains'
import { ToDo } from '~/contracts'

type Data = {
  address: Address
  total: string
  items: {
    value: {
      user: string
      timestamp: string
      content: string
      status: string
      lastUpdated: string
    }
    queryIndex: string
  }[]
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<Data>) {
  const address = req.query.address as Address

  const client = createPublicClient({
    chain: sepolia,
    transport: http(process.env.NEXT_PUBLIC_CHAIN_URL),
  })

  const total = await singleQuery(client, ToDo.call.numItems(address))
  const items = await iteratorQuery(client, total, (i) => ToDo.call.item(address, i), { firstIndex: 1n })

  res.status(200).json({ address, total: total.toString(), items: JSON.parse(stringify(items)) })
}
