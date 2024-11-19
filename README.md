# DappQL

## Querying data from smart-contracts made easy.

An extention of useDapp to help generate code for querying contract data with the power of typescript

## Installation

In your terminal, run:

```bash
npm install -G dappql
```

## Usage

In the root of your project, add a `dapp.config.js` file like the following:

```javascript
module.exports = {
  // Where the generate code is going to be located
  targetPath: './contracts',

  // Contract names:
  contracts: {
    ToDo: {
      address: '0x29B63f08aBa4Be48873238C23693a5550bC1E93F',
      abi: [
        {
          type: 'function',
          name: 'addItem',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: '_content',
              type: 'string',
            },
            {
              name: '_status',
              type: 'uint256',
            },
          ],
          outputs: [
            {
              name: '',
              type: 'uint256',
            },
          ],
        },
        {
          type: 'function',
          name: 'updateItem',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: '_id',
              type: 'uint256',
            },
            {
              name: '_content',
              type: 'string',
            },
            {
              name: '_status',
              type: 'uint256',
            },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'updateStatus',
          stateMutability: 'nonpayable',
          inputs: [
            {
              name: '_id',
              type: 'uint256',
            },
            {
              name: '_status',
              type: 'uint256',
            },
          ],
          outputs: [],
        },
        {
          type: 'function',
          name: 'numItems',
          stateMutability: 'view',
          inputs: [
            {
              name: 'arg0',
              type: 'address',
            },
          ],
          outputs: [
            {
              name: '',
              type: 'uint256',
            },
          ],
        },
        {
          type: 'function',
          name: 'item',
          stateMutability: 'view',
          inputs: [
            {
              name: 'arg0',
              type: 'address',
            },
            {
              name: 'arg1',
              type: 'uint256',
            },
          ],
          outputs: [
            {
              name: '',
              type: 'tuple',
              components: [
                {
                  name: 'user',
                  type: 'address',
                },
                {
                  name: 'timestamp',
                  type: 'uint256',
                },
                {
                  name: 'content',
                  type: 'string',
                },
                {
                  name: 'status',
                  type: 'uint256',
                },
                {
                  name: 'lastUpdated',
                  type: 'uint256',
                },
              ],
            },
          ],
        },
      ],
    },
  },
}
```

## Generating the code:

On your application folder, run the command:

```bash
dappql
```

and see the magic happen!

<p align="center"><img src="./images/cli.png" width="400px" /></p>

You'll see the process happening and the code should be in the generated folder.

<p align="center"><img src="./images/output-files.png" width="400px" /></p>

## Using it:

Below there's an example of how to make a single query to multiple contracts using the QueryContainer component:

```typescript
import { useEthers } from '@usedapp/core'
import { formatEther } from 'ethers/lib/utils'

import { call, QueryContainer, QueryData } from '../contracts'

const QueryFunction = (account: string) => ({
  bestUserTasksCount: call.ToDo('totalUserTasks', [account]),
  totalTasks: call.ToDo('totalTasks', []),
  openId: call.ToDo('statusCode', ['OPEN']),
  inProgressId: call.ToDo('statusCode', ['IN_PROGRESS']),
  doneId: call.ToDo('statusCode', ['COMPLETE']),
  tokenTotal: call.Token('totalSupply', []),
  tokenName: call.Token('name', []),
  tokenSymbol: call.Token('symbol', []),
  balanceOf: call.Token('balanceOf', [account]),
})

type Props = {
  data: QueryData<ReturnType<typeof QueryFunction>>
}

function TestPage(props: Props) {
  return (
    <div>
      <p>Best User Count: {props.data.bestUserTasksCount.toString()}</p>
      <p>Total Tasks: {props.data.totalTasks.toString()}</p>
      <p>OPEN ID: {props.data.openId}</p>
      <p>IN_PROGRESS ID: {props.data.inProgressId}</p>
      <p>DONE ID: {props.data.doneId}</p>
      <p>Token Total Supply: {formatEther(props.data.tokenTotal)}</p>
      <p>Token Symbol: {props.data.tokenSymbol}</p>
      <p>Token Name: {props.data.tokenName}</p>
      <p>Balance: {formatEther(props.data.balanceOf)}</p>
    </div>
  )
}

export function TestPageQueryContainer({ account }: { account: string }) {
  const query = QueryFunction(account)
  return <QueryContainer query={query} component={TestPage} />
}

export default function Root() {
  const { account } = useEthers()
  if (account) {
    return <TestPageQueryContainer account={account} />
  }

  return null
}
```

All the return types should have typescript types and autocomplete based on the method calls.

## Hooks

Every contract in the configuration file will have it's own hook file with a `use{ContractName}Call` and `use{ContractName}Function` to execute the calls and transactions individually.

```typescript
import { useToDoCall, useToDoFunction } from '../../contracts/hooks/useToDo'

const [value, error, loading] = useToDoCall('statusName', [1])
const transaction = useToDoFunction('createTask')
```

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change.

## Example project

https://github.com/VyperTraining/web-app

## License

[MIT](https://choosealicense.com/licenses/mit/)
