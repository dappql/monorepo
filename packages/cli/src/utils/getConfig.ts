import { existsSync } from 'fs'
import { join } from 'path'
import { pathToFileURL } from 'url'

export default async function getConfig() {
  const CONFIG_PATH = join(process.cwd(), 'dapp.config.js')
  console.log('Looking for config at:', CONFIG_PATH)

  if (!existsSync(CONFIG_PATH)) {
    throw new Error(
      `Config file not found at ${CONFIG_PATH}\n` +
        'Please create a dapp.config.js file in your project root directory.',
    )
  }

  const configUrl = pathToFileURL(CONFIG_PATH).href
  return (await import(configUrl)).default as Config
}
