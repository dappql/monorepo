import path from 'path'

async function getAbiFromEtherscan(
  contractName: string,
  contract: ContractConfig,
  etherscanApiKey?: string,
  etherscanApi = 'https://api.ehterscan.io',
) {
  if (contract.address && etherscanApiKey) {
    return {
      ...contract,
      contractName,
      // TODO: implement etherscan integration
      abi: undefined,
    }
  }

  return { ...contract, contractName }
}

export default function extractAbis(config: Config) {
  return Promise.all(
    Object.keys(config.contracts).map(async (contractName) => {
      const contract = config.contracts[contractName]
      if (contract.abi) {
        return { ...contract, contractName }
      }

      if (config.abiSourcePath) {
        const pathName = path.join(config.abiSourcePath, `${contractName}.json`)
        try {
          const abi = require(pathName) as AbiFunction[]
          return { ...contract, contractName, abi }
        } catch {}
      }

      return getAbiFromEtherscan(contractName, contract, config.etherscanApiKey, config.etherscanApi)
    }),
  )
}
