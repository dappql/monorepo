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
        name: 'tokenId',
        type: 'uint256',
        indexed: true,
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
        name: 'approved',
        type: 'address',
        indexed: true,
      },
      {
        name: 'tokenId',
        type: 'uint256',
        indexed: true,
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ApprovalForAll',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
      },
      {
        name: 'operator',
        type: 'address',
        indexed: true,
      },
      {
        name: 'approved',
        type: 'bool',
        indexed: false,
      },
    ],
    anonymous: false,
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
  },
  {
    type: 'function',
    name: 'getApproved',
    stateMutability: 'view',
    inputs: [
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
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
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'string',
      },
    ],
  },
  {
    type: 'function',
    name: 'supportsInterface',
    stateMutability: 'pure',
    inputs: [
      {
        name: '_interfaceId',
        type: 'bytes4',
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
    name: 'tokenByIndex',
    stateMutability: 'view',
    inputs: [
      {
        name: '_index',
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
    name: 'tokenOfOwnerByIndex',
    stateMutability: 'view',
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_index',
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
    name: 'transferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_recipient',
        type: 'address',
      },
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_recipient',
        type: 'address',
      },
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'safeTransferFrom',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_owner',
        type: 'address',
      },
      {
        name: '_recipient',
        type: 'address',
      },
      {
        name: '_tokenId',
        type: 'uint256',
      },
      {
        name: '_data',
        type: 'bytes',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_operator',
        type: 'address',
      },
      {
        name: '_tokenId',
        type: 'uint256',
      },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setApprovalForAll',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: '_operator',
        type: 'address',
      },
      {
        name: '_approved',
        type: 'bool',
      },
    ],
    outputs: [],
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
    name: 'isApprovedForAll',
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
    name: 'idToOwner',
    stateMutability: 'view',
    inputs: [
      {
        name: 'arg0',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
  },
  {
    type: 'function',
    name: 'idToApprovals',
    stateMutability: 'view',
    inputs: [
      {
        name: 'arg0',
        type: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
  },
] as const

const getERC721Contract = (address: Address, client: Client) => getContract({ client, abi, address })

export type ERC721Contract = ReturnType<typeof getERC721Contract>
export type ERC721ContractQueries = keyof ERC721Contract['read']
export type ERC721ContractMutations = keyof ERC721Contract['write']

export function ERC721Call<M extends ERC721ContractQueries>(
  method: M,
  args: ExtractCallArgs<ERC721Contract['read'][M]>,
  contractAddress: Address,
  defaultValue?: Awaited<ReturnType<ERC721Contract['read'][M]>>,
) {
  return {
    abi,
    method,
    args,
    contractAddress,
    defaultValue,
    contractName: 'ERC721' as const,
  }
}

export function ERC721Mutation<M extends ERC721ContractMutations>(functionName: M) {
  return {
    contractName: 'ERC721' as const,
    functionName,
    abi,
    argsType: undefined as ExtractMutationArgs<ERC721Contract['write'][M]> | undefined,
  }
}

const ERC721 = {
  abi,
  getContract: getERC721Contract,
  call: ERC721Call,
  mutation: ERC721Mutation,
}

export default ERC721
