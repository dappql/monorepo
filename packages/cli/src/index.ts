import figlet from 'figlet'

import generate from './commands/generate.js'
import pack from './commands/pack.js'
import logger, { Severity } from './utils/logger.js'

const HELP = `
Usage: dappql [command]

Commands:
  generate   Generate typed contract modules + AGENTS.md (default)
  pack       Build a publishable npm package from your DappQL project
  help       Show this message

Run with no command to use 'generate'.
`

async function main() {
  logger(figlet.textSync('DappQL', { horizontalLayout: 'full' }), Severity.info)
  logger('Querying data from smart-contracts made easy.\n', Severity.info)

  const cmd = process.argv[2]

  switch (cmd) {
    case undefined:
    case 'generate':
      await generate()
      return
    case 'pack':
      await pack()
      return
    case 'help':
    case '--help':
    case '-h':
      console.log(HELP)
      return
    default:
      logger(`Unknown command: ${cmd}`, Severity.error)
      console.log(HELP)
      process.exit(1)
  }
}

main().catch((e) => {
  logger(e.message, Severity.error)
  process.exit(1)
})
