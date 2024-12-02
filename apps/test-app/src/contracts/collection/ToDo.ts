/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import { ExtractCallArgs, ExtractMutationArgs } from '@dappql/core'
import { Address, Client, getContract } from 'viem'

const abi = [
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
] as const

const deployAddress: Address | undefined = '0x29B63f08aBa4Be48873238C23693a5550bC1E93F'

const getToDoContract = (address: Address, client: Client) => getContract({ client, abi, address })
export type ToDoContract = ReturnType<typeof getToDoContract>

export type ToDoContractQueries = keyof ToDoContract['read']
export function ToDoCall<M extends ToDoContractQueries>(
  method: M,
  args: ExtractCallArgs<ToDoContract['read'][M]>,
  contractAddressOrOptions?:
    | Address
    | {
        contractAddress?: Address
        defaultValue?: Awaited<ReturnType<ToDoContract['read'][M]>>
      },
) {
  const address =
    typeof contractAddressOrOptions === 'string' ? contractAddressOrOptions : contractAddressOrOptions?.contractAddress
  const defaultValue = typeof contractAddressOrOptions === 'string' ? undefined : contractAddressOrOptions?.defaultValue

  return {
    contractName: 'ToDo' as const,
    method,
    args,
    address,
    deployAddress,
    defaultValue,
    getAbi: () => abi,
  }
}

export type ToDoContractMutations = keyof ToDoContract['write']
export function ToDoMutation<M extends ToDoContractMutations>(functionName: M) {
  return {
    contractName: 'ToDo' as const,
    functionName,
    deployAddress,
    argsType: undefined as ExtractMutationArgs<ToDoContract['write'][M]> | undefined,
    getAbi: () => abi,
  }
}

const ToDo = {
  deployAddress,
  abi,
  getContract: getToDoContract,
  call: ToDoCall,
  mutation: ToDoMutation,
}

export default ToDo
