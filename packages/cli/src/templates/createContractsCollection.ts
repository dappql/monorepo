import { writeFileSync } from 'fs'
import { join } from 'path'

import { RUNNING_DIRECTORY } from '../utils/constants.js'
import touchDirectory from '../utils/touchDir.js'
import generateContractTypes from '../utils/generateTypes.js'
import { PublicClient } from 'viem'

function createContractFile(contract: ContractConfig & { contractName: string }, isSdk?: boolean) {
  if (!contract.abi) {
    throw new Error('ABI not fetched')
  }

  const readMethods = contract.abi
    .filter((a) => a.type === 'function' && (a.stateMutability === 'pure' || a.stateMutability === 'view'))
    .reduce((acc, a) => {
      if (acc.includes(a.name)) return acc
      return [...acc, a.name]
    }, [] as string[])

  const hasRead = !!readMethods.length

  const writeMethods = contract.abi
    .filter((a) => a.type === 'function' && (a.stateMutability === 'nonpayable' || a.stateMutability === 'payable'))
    .reduce((acc, a) => {
      if (acc.includes(a.name)) return acc
      return [...acc, a.name]
    }, [] as string[])

  const hasWrite = !!writeMethods.length

  const dappqlImports = []

  if (isSdk) {
    if (hasRead) {
      dappqlImports.push('singleQuery')
    }
    if (hasWrite) {
      dappqlImports.push('mutate')
    }
  }

  const content = `/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
/* @ts-nocheck */

${dappqlImports.length ? `import { ${dappqlImports.join(', ')} } from '@dappql/async'` : ''}
${isSdk ? `import { PublicClient, WalletClient } from 'viem'` : ''}

${hasRead || hasWrite ? `type ExtractArgs<T> = T extends (...args: infer P) => any ? P : never` : ''}
type Address = ${'`0x${string}`'}


export const abi = ${JSON.stringify(contract.abi, undefined, 4)} as const

export const deployAddress: Address | undefined = ${contract.address ? `'${contract.address}'` : 'undefined'}

${generateContractTypes(contract.abi)}
${
  hasRead
    ? `
export type Calls = keyof Contract['calls']
export type Request<M extends Calls> = {
  contractName: '{{CONTRACT_NAME}}'
  method: M
  args: ExtractArgs<Contract['calls'][M]>
  address: Address | undefined
  deployAddress: Address | undefined
  defaultValue: Awaited<ReturnType<Contract['calls'][M]>> | undefined
  getAbi: () => typeof abi
  with: (options: {
    contractAddress?: Address
    defaultValue?: Awaited<ReturnType<Contract['calls'][M]>>
  }) => Request<M>
  defaultTo: (defaultValue: Awaited<ReturnType<Contract['calls'][M]>>) => Request<M>
  at: (address: Address) => Request<M>
}
export type CallReturn<M extends Calls> = NonNullable<Request<M>['defaultValue']>

function getRequest<M extends Calls>(
  method: M,
  args: ExtractArgs<Contract['calls'][M]>,
  contractAddressOrOptions?:
  | Address
  | {
    contractAddress?: Address
    defaultValue?: Awaited<ReturnType<Contract['calls'][M]>>
    },
  ): Request<M> {
    const address =
      typeof contractAddressOrOptions === 'string' ? contractAddressOrOptions : contractAddressOrOptions?.contractAddress
    const defaultValue = typeof contractAddressOrOptions === 'string' ? undefined : contractAddressOrOptions?.defaultValue

    const call = {
      contractName: '{{CONTRACT_NAME}}' as const,
      method,
      args,
      address,
      deployAddress,
      defaultValue,
      getAbi: () => abi,
      with: (options: {
        contractAddress?: Address
        defaultValue?: Awaited<ReturnType<Contract['calls'][M]>>
      }) => {
          call.address = options.contractAddress
          call.defaultValue = options.defaultValue
          return call as Request<M>
      },
      defaultTo: (defaultValue: Awaited<ReturnType<Contract['calls'][M]>>) => {
        call.defaultValue = defaultValue
        return call as Request<M>
      },
      at: (address: Address) => {
        call.address = address
        return call as Request<M>
      },
    } as Request<M>

    return call
}

type CallType = {
  [K in Calls]: (
    ...args: ExtractArgs<Contract['calls'][K]>
  ) => ReturnType<typeof getRequest<K>>
}

export const call: CallType = {
${readMethods.map((m) => `\t\t${m}: (...args: ExtractArgs<Contract['calls']['${m}']>) => getRequest('${m}', args),`).join('\n')}
}
`
    : ''
}
${
  hasWrite
    ? `
export type Mutations = keyof Contract['mutations']
function getMutation<M extends Mutations>(functionName: M) {
  return {
    contractName: '{{CONTRACT_NAME}}' as const,
    functionName,
    deployAddress,
    argsType: undefined as ExtractArgs<Contract['mutations'][M]> | undefined,
    getAbi: () => abi,
  }
}

export const mutation:  {
  [K in Mutations]: {
    contractName: '{{CONTRACT_NAME}}'
    deployAddress: Address | undefined
    getAbi: () => typeof abi
    functionName: K
    argsType: ExtractArgs<Contract['mutations'][K]> | undefined
  }
} = {
${writeMethods.map((m) => `\t\t${m}: getMutation('${m}'),`).join('\n')}
}
`
    : ''
}

${
  isSdk
    ? `

export type SDK = {
${readMethods.map((m) => `\t\t${m}: (...args: ExtractArgs<Contract['calls']['${m}']>) => Promise<CallReturn<'${m}'>>`).join('\n')}
${writeMethods.map((m) => `\t\t${m}: (...args: ExtractArgs<Contract['mutations']['${m}']>) => Promise<Address>`).join('\n')}
}

export function toSdk(publicClient?: PublicClient, walletClient?: WalletClient): SDK {
  return {
    // Queries
${readMethods.map((m) => `\t\t${m}: (...args: ExtractArgs<Contract['calls']['${m}']>) => singleQuery(publicClient!, call.${m}(...args)) as Promise<CallReturn<'${m}'>>,`).join('\n')}
    
    // Mutations
${writeMethods.map((m) => `\t\t${m}: (...args: ExtractArgs<Contract['mutations']['${m}']>) => mutate(walletClient!, mutation.${m})(...args),`).join('\n')}
  }
}`
    : ''
}

`.replaceAll('{{CONTRACT_NAME}}', contract.contractName)

  return { content, hasRead, hasWrite }
}

export default function createContractsCollection(
  contracts: (ContractConfig & { contractName: string })[],
  target: string,
  isModule?: boolean,
  isSdk?: boolean,
) {
  const collectionPath = join(RUNNING_DIRECTORY, target)
  touchDirectory(collectionPath)

  const generated = contracts.map((c) => {
    const contractPath = join(collectionPath, `${c.contractName}.ts`)
    const { hasRead, hasWrite, content } = createContractFile(c, isSdk)
    writeFileSync(contractPath, content)
    return { hasRead, hasWrite, ...c }
  })

  const collectionIndex = `/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
/* @ts-nocheck */
  
${generated.map((c) => `export * as ${c.contractName} from './${c.contractName}${isModule ? '.js' : ''}'`).join('\n')}
`

  writeFileSync(join(collectionPath, 'index.ts'), collectionIndex)

  if (isSdk) {
    const sdk = `/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
/* @ts-nocheck */

import { PublicClient, WalletClient } from 'viem'

${generated.map((c) => `import * as ${c.contractName} from './${c.contractName}${isModule ? '.js' : ''}'`).join('\n')}

export type SDK = {
${generated.map((c) => `\t\t${c.contractName}: ${c.contractName}.SDK`).join('\n')}
}

export default function createSdk(publicClient?: PublicClient, walletClient?: WalletClient): SDK {
  return {
${generated.map((c) => `\t\t${c.contractName}: ${c.contractName}.toSdk(publicClient, walletClient),`).join('\n')}
  }
}
  `
    writeFileSync(join(collectionPath, 'sdk.ts'), sdk)
  }
}
