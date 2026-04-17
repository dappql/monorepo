import { existsSync, mkdirSync } from 'fs'
import path from 'path'

export default function touchDirectory(dir: string) {
  const subDirs = dir.split(path.sep)

  let last = ''
  subDirs.forEach((s) => {
    const current = last + s + path.sep
    if (!existsSync(current)) {
      mkdirSync(current)
    }
    last = current
  })
}
