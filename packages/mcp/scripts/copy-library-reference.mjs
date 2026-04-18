#!/usr/bin/env node
// Copies the monorepo's root AGENTS.md into this package's assets/ so the
// installed @dappql/mcp can serve it as the `dappql://docs/library` resource
// without any network dependency. Runs as a prebuild step.

import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const src = resolve(here, '../../../AGENTS.md')
const dest = resolve(here, '../assets/library-reference.md')

if (!existsSync(src)) {
  console.warn(`[@dappql/mcp] source AGENTS.md not found at ${src} — skipping library-reference copy.`)
  process.exit(0)
}

mkdirSync(dirname(dest), { recursive: true })
copyFileSync(src, dest)
console.log(`[@dappql/mcp] library-reference synced from ${src}`)
