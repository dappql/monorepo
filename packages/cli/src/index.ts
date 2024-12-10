import figlet from 'figlet'

import createContractsCollection from './templates/createContractsCollection.js'
import clean from './utils/clean.js'
import extractAbis from './utils/extractAbis.js'
import getConfig from './utils/getConfig.js'
import logger, { Severity } from './utils/logger.js'

async function main() {
  logger(figlet.textSync('DappQL', { horizontalLayout: 'full' }), Severity.info)
  logger('Querying data from smart-contracts made easy.\n', Severity.info)

  logger('Loading config file ...\n', Severity.warning)
  const config = await getConfig()

  clean(config.targetPath)

  logger('Fetching ABIs...')
  const contracts = (await extractAbis(config)).sort((c1, c2) => (c1.contractName < c2.contractName ? -1 : 1))

  const missingAbis = contracts.filter((c) => !c.abi)
  if (missingAbis.length)
    logger(`Missing ABIs for:\n${missingAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`, Severity.error)

  const contractsWithAbis = contracts.filter((c) => !!c.abi)
  if (contractsWithAbis.length) {
    logger(`Generating DappQL code for:\n${contractsWithAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`)
    createContractsCollection(contractsWithAbis, config.targetPath, config.isModule)
    logger('\n\nDone! 🎉\n\n', Severity.success)
  }
}

main().catch((e) => logger(e.message, Severity.error))
