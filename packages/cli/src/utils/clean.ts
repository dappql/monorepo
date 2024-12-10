import fs from 'fs'
import { join } from 'path'

import { RUNNING_DIRECTORY } from './constants.js'

export default function clean(targetPath: string) {
  const path = join(RUNNING_DIRECTORY, targetPath)
  if (!fs.existsSync(path)) {
    return
  }

  fs.rmSync(path, { recursive: true, force: true })
}
