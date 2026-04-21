import { createAgentsFile, createContractsCollection } from '@dappql/codegen'
import { relative } from 'path'

import clean from '../utils/clean.js'
import { RUNNING_DIRECTORY } from '../utils/constants.js'
import extractAbis from '../utils/extractAbis.js'
import getConfig from '../utils/getConfig.js'
import logger, { Severity } from '../utils/logger.js'

export default async function generate() {
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
    createContractsCollection(contractsWithAbis, config.targetPath, config.isModule, config.isSdk)

    const agents = createAgentsFile(contractsWithAbis, config)
    if (agents) {
      const rel = relative(RUNNING_DIRECTORY, agents.path) || agents.path
      const verb = agents.mode === 'created' ? 'Created' : agents.mode === 'updated' ? 'Updated' : 'Appended to'
      logger(`${verb} AI-agent guide at ./${rel}`, Severity.info)
    }

    logger('\n\nDone! 🎉\n\n', Severity.success)
  }
}
