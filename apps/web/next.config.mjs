import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// Single source of truth for the displayed version: the monorepo root
// package.json, which `npm run release` keeps in sync with the extension.
const rootPkg = JSON.parse(
  readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '../../package.json'),
    'utf8',
  ),
)

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@sip/ui', '@sip/types'],
  env: {
    NEXT_PUBLIC_APP_VERSION: rootPkg.version,
  },
}

export default nextConfig
