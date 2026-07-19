#!/usr/bin/env node
// Release helper for the SIP Chrome extension.
//
//   npm run release                  -> patch bump (1.0.0 -> 1.0.1)
//   npm run release -- minor         -> minor bump (1.0.0 -> 1.1.0)
//   npm run release -- major         -> major bump (1.0.0 -> 2.0.0)
//   npm run release -- 1.4.2         -> set an explicit version
//   npm run release -- current       -> build+zip the current version, no bump
//                                       (use this for the very first upload)
//   npm run release -- patch --dry-run   -> show what would happen, change nothing
//
// NOTE the `--` before the arguments: npm otherwise swallows flags like
// --dry-run and words it recognizes before they ever reach this script.
//
// It bumps the version in manifest.json + both package.json files (kept in
// sync), builds the extension, and zips dist/ into releases/sip-vX.Y.Z.zip
// with manifest.json at the zip root — the layout the Chrome Web Store expects.

import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// Files whose "version" field we keep identical. manifest.json is the one
// Chrome actually reads; the package.json files are synced so nothing drifts.
const MANIFEST = join(root, 'apps/extension/manifest.json')
const VERSION_FILES = [
  MANIFEST,
  join(root, 'apps/extension/package.json'),
  join(root, 'package.json'),
]

const DIST = join(root, 'apps/extension/dist')
const RELEASES = join(root, 'releases')

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const bumpArg = args.find((a) => !a.startsWith('-')) ?? 'patch'

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v)
  if (!m) fail(`"${v}" is not a valid X.Y.Z version`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function isGreater(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] > b[i]) return true
    if (a[i] < b[i]) return false
  }
  return false // equal
}

// --- work out the next version -------------------------------------------

const current = readJson(MANIFEST).version
const [maj, min, pat] = parseVersion(current)

// "current" builds + zips the existing version without bumping — for the very
// first upload, or to re-pack after code changes without moving the version.
const noBump = bumpArg === 'current'

let next
if (noBump) next = current
else if (bumpArg === 'patch') next = `${maj}.${min}.${pat + 1}`
else if (bumpArg === 'minor') next = `${maj}.${min + 1}.0`
else if (bumpArg === 'major') next = `${maj + 1}.0.0`
else next = bumpArg // explicit version

const nextParsed = parseVersion(next)

// Chrome rejects a version that isn't strictly greater than the live one.
// (Skipped for "current", which intentionally keeps the same version.)
if (!noBump && !isGreater(nextParsed, [maj, min, pat])) {
  fail(
    `Next version ${next} must be greater than current ${current}. ` +
      `Chrome rejects reused or lower versions.`,
  )
}

// --- warn on a dirty tree (non-fatal) ------------------------------------

try {
  const dirty = execSync('git status --porcelain', { cwd: root }).toString().trim()
  if (dirty) {
    console.warn(
      '⚠  Working tree has uncommitted changes — the build will include them.\n',
    )
  }
} catch {
  // not a git repo / git missing — ignore
}

const headline = noBump
  ? `SIP release: packaging current version ${current}`
  : `SIP release: ${current} -> ${next}`
console.log(`${headline}${dryRun ? '  (dry run)' : ''}\n`)

if (dryRun) {
  if (noBump) console.log('Would leave all version fields at ' + current)
  else {
    console.log('Would update version in:')
    for (const f of VERSION_FILES) console.log(`  • ${f.replace(root + '/', '')}`)
  }
  console.log(`Would build and write releases/sip-v${next}.zip`)
  process.exit(0)
}

// --- bump every version file (skipped for "current") ---------------------

if (!noBump) {
  for (const file of VERSION_FILES) {
    const raw = readFileSync(file, 'utf8')
    // Surgically swap only the version string so hand-formatting (e.g. the
    // manifest's inline arrays) is preserved — a full JSON reserialize would
    // reflow the whole file.
    const bumped = raw.replace(
      /("version"\s*:\s*")\d+\.\d+\.\d+(")/,
      `$1${next}$2`,
    )
    if (bumped === raw) fail(`Could not find a version field to bump in ${file}`)
    writeFileSync(file, bumped)
    console.log(`  bumped ${file.replace(root + '/', '')}`)
  }
}

// --- build ----------------------------------------------------------------

console.log('\nBuilding extension…\n')
execSync('npm run build --workspace @sip/extension', { cwd: root, stdio: 'inherit' })

if (!existsSync(join(DIST, 'manifest.json'))) {
  fail('Build finished but dist/manifest.json is missing — aborting zip.')
}

// --- zip dist/ (contents at the zip root) --------------------------------

mkdirSync(RELEASES, { recursive: true })
const zipPath = join(RELEASES, `sip-v${next}.zip`)
execSync(`rm -f "${zipPath}"`)
// -r recurse, -X strip extra file attributes; run from inside dist so the
// archive has manifest.json at its root, not a dist/ wrapper folder.
execSync(`cd "${DIST}" && zip -r -X "${zipPath}" . -x '.DS_Store' -x '*/.DS_Store'`, {
  stdio: 'inherit',
})

console.log(`\n✓ Wrote ${zipPath.replace(root + '/', '')}\n`)
console.log('Next steps:')
console.log('  1. Chrome Web Store → Developer Dashboard → your item → Package → Upload new package')
console.log(`  2. Upload releases/sip-v${next}.zip`)
console.log('  3. Submit for review')
if (!noBump) {
  console.log('  4. (optional) commit the version bump:')
  console.log(`       git commit -am "release v${next}"`)
}
