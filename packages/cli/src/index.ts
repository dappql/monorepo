import figlet from 'figlet'

import createContractsCollection from './templates/createContractsCollection'
import clean from './utils/clean'
import extractAbis from './utils/extractAbis'
import getConfig from './utils/getConfig'
import logger, { Severity } from './utils/logger'

async function main() {
  logger(figlet.textSync('DappQL', { horizontalLayout: 'full' }), Severity.info)
  logger('Querying data from smart-contracts made easy.\n', Severity.info)

  logger('Loading config file ...\n', Severity.warning)
  const config = getConfig()

  clean(config.targetPath)

  logger('Fetching ABIs...')
  const contracts = (await extractAbis(config)).sort((c1, c2) => (c1.contractName < c2.contractName ? -1 : 1))

  const missingAbis = contracts.filter((c) => !c.abi)
  if (missingAbis.length)
    logger(`Missing ABIs for:\n${missingAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`, Severity.error)

  const contractsWithAbis = contracts.filter((c) => !!c.abi)
  if (contractsWithAbis.length) {
    logger(`Generating DappQL code for:\n${contractsWithAbis.map((c) => `\n\t- ${c.contractName}`).join('')}\n`)
    createContractsCollection(contractsWithAbis, config.targetPath)
    logger('\n\nDone! 🎉\n\n', Severity.success)
  }
}

main().catch((e) => logger(e.message, Severity.error))
