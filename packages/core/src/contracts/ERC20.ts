import { type Address, type Client, getContract } from 'viem'

import type { ExtractCallArgs, ExtractMutationArgs } from '../types.js'

const abi = [
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      {
        name: 'sender',
        type: 'address',
        indexed: true,
      },
      {
        name: 'receiver',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
      },
      {
        name: 'spender',
        type: 'address',
        indexed: true,
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'name',
    stateMutability: 'pure',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'pure',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'pure',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
      },
    ],
  },
  {
    type: 'function',
    name: 'transfer',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_recipient',
        type: 'address',
      },
      {
        name: '_amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_sender',
        type: 'address',
      },
      {
        name: '_recipient',
        type: 'address',
      },
      {
        name: '_amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_spender',
        type: 'address',
      },
      {
        name: '_amount',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'permit',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_spender',
        type: 'address',
      },
      {
        name: '_amount',
        type: 'uint256',
      },
      {
        name: '_expiry',
        type: 'uint256',
      },
      {
        name: '_signature',
        type: 'bytes',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
      },
    ],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
      },
    ],
  },
  {
    type: 'function',
    name: 'balanceOf',
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
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      {
        name: 'arg0',
        type: 'address',
      },
      {
        name: 'arg1',
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
    name: 'nonces',
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
    name: 'DOMAIN_SEPARATOR',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
      },
    ],
  },
] as const

const getERC20Contract = (address: Address, client: Client) => getContract({ client, abi, address })

export type ERC20Contract = ReturnType<typeof getERC20Contract>
export type ERC20ContractQueries = keyof ERC20Contract['read']
export type ERC20ContractMutations = keyof ERC20Contract['write']

export function ERC20Call<M extends ERC20ContractQueries>(
  method: M,
  args: ExtractCallArgs<ERC20Contract['read'][M]>,
  contractAddress: Address,
  defaultValue?: Awaited<ReturnType<ERC20Contract['read'][M]>>,
) {
  return {
    contractName: 'ERC20' as const,
    method,
    args,
    contractAddress,
    defaultValue,
    getAbi: () => abi,
  }
}

export function ERC20Mutation<M extends ERC20ContractMutations>(functionName: M) {
  return {
    contractName: 'ERC20' as const,
    functionName,
    argsType: undefined as ExtractMutationArgs<ERC20Contract['write'][M]> | undefined,
    getAbi: () => abi,
  }
}

const ERC20 = {
  abi,
  getContract: getERC20Contract,
  call: ERC20Call,
  mutation: ERC20Mutation,
}

export default ERC20
