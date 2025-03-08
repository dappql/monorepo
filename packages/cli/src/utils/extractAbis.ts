import path from 'path'
import { readFileSync } from 'fs'

async function getAbiFromEtherscan(
  contractName: string,
  contract: ContractConfig,
  etherscanApiKey?: string,
  etherscanApi = 'https://api.etherscan.io',
) {
  const address = contract.address || (contract as string)
  if (address && etherscanApiKey) {
    const params = new URLSearchParams({
      apikey: etherscanApiKey,
      module: 'contract',
      action: 'getabi',
      address: address,
    })

    const url = `${etherscanApi}/api?${params.toString()}`
    try {
      console.log('Fetching ABI for:', contractName, 'from:', etherscanApi)
      const response = await fetch(url)
      const data = (await response.json()) as { status: string; result: string; message?: string }
      if (data.status === '1' && data.result) {
        const abi = JSON.parse(data.result)
        return {
          ...contract,
          contractName,
          abi,
        }
      }
      console.error(`Failed to fetch ABI from ${etherscanApi} for ${contractName}:`, data.message || 'Unknown error')
    } catch (error) {
      console.error(`Error fetching ABI for ${contractName}:`, error)
    }

    return {
      ...contract,
      contractName,
      abi: undefined,
    }
  }

  return { ...contract, contractName }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function extractAbis(config: Config) {
  // Process contracts sequentially instead of in parallel to respect rate limits
  const results = []
  for (const contractName of Object.keys(config.contracts)) {
    const contract = config.contracts[contractName]
    if (contract.abi) {
      results.push({ ...contract, contractName })
      continue
    }

    if (config.abiSourcePath) {
      const pathName = path.join(process.cwd(), config.abiSourcePath, `${contractName}.json`)
      try {
        const abi = JSON.parse(readFileSync(pathName, 'utf8')) as AbiFunction[]
        results.push({ ...contract, contractName, abi })
        continue
      } catch (error) {
        console.error('Error loading ABI from file:', error)
      }
    }

    // Add delay before each Etherscan API call
    await sleep(250) // 250ms delay = ~4 requests per second, staying under the 5/sec limit
    const result = await getAbiFromEtherscan(contractName, contract, config.etherscanApiKey, config.etherscanApi)
    results.push(result)
  }

  return results
}
