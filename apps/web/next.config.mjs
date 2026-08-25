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

  // Keep the dev-only annotation tool out of production builds.
  //
  // A `process.env.NODE_ENV` guard around the dynamic() call is NOT enough:
  // next/dynamic hoists the import into the module graph via its SWC
  // transform, so webpack emits the chunk whatever the surrounding condition
  // says. That shipped a 430 KB chunk — a third of the entire static payload —
  // that no user would ever download but every deploy carried. Aliasing the
  // specifier to `false` resolves it to an empty module instead, so the chunk
  // is never created. It also means a production install can drop the
  // devDependency without the build failing to resolve it.
  webpack: (config, { dev }) => {
    if (!dev) config.resolve.alias = { ...config.resolve.alias, agentation: false }
    return config
  },
}

export default nextConfig
