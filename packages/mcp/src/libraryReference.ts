import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'

// Bundled by scripts/copy-library-reference.mjs at build time. Lives at
// <package>/assets/library-reference.md, one level up from dist/*.js
// after compilation.
const LIBRARY_REFERENCE_PATH = (() => {
  try {
    return fileURLToPath(new URL('../assets/library-reference.md', import.meta.url))
  } catch {
    return null
  }
})()

export function loadLibraryReference(): string | null {
  if (!LIBRARY_REFERENCE_PATH) return null
  try {
    return readFileSync(LIBRARY_REFERENCE_PATH, 'utf8')
  } catch {
    return null
  }
}

export const LIBRARY_REFERENCE_FALLBACK =
  '# DappQL library reference\n\nNot bundled with this build.\n\n' +
  'See https://github.com/dappql/core/blob/main/AGENTS.md for the canonical reference.'
