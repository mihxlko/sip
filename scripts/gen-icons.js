#!/usr/bin/env node
// Regenerate every app icon from one master PNG.
//
//   npm run gen-icons -- path/to/logo-1024.png
//   npm run gen-icons -- path/to/logo.png --dry-run
//
// NOTE the `--`, as with the other scripts here — npm eats flags otherwise.
//
// WHY A SCRIPT AND NOT A FEW sips CALLS
//   The two icon families in this repo use DIFFERENT size conventions and the
//   names do not tell you which:
//
//     sip-icon-N.png   is 2N px   — 16 -> 32, 32 -> 64, 64 -> 128, 128 -> 256
//     iconN.png        is N px    — 16 -> 16, 32 -> 32, 48 -> 48, 128 -> 128
//
//   Getting that backwards produces files that look right in a listing and are
//   blurry or oversized in the toolbar. The table below is the source of truth.
//
// LIGHT AND DARK
//   platform.ts (both apps) picks sip-icon-dark-N.png under a dark theme, so
//   those names have to keep existing. The v2 mark is one piece of art that
//   works on both, so the dark files are written with identical bytes. Drop a
//   real dark master in and give this script a --dark flag if that changes.

import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const src = args.find(a => !a.startsWith('-'))

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

if (!src) fail('Usage: npm run gen-icons -- <master.png> [--dry-run]')
const master = resolve(process.cwd(), src)
if (!existsSync(master)) fail(`${master} does not exist.`)

// name -> rendered pixel size
const SIP_ICON = { 16: 32, 32: 64, 64: 128, 128: 256 } // sip-icon-N.png  (2x)
const PLAIN_ICON = [16, 32, 48, 128] //                   iconN.png       (1x)

// Every directory that carries a copy. icons/ gets the full set; logos/ only
// the 64 pair, which is what the nav mark and the built extension reference.
const ICON_DIRS = ['apps/web/public/icons', 'apps/extension/public/icons']
const LOGO_DIRS = ['apps/web/public/logos', 'apps/extension/public/logos']

const srcW = Number(
  execFileSync('sips', ['-g', 'pixelWidth', master]).toString().trim().split(/\s+/).pop(),
)
if (srcW < 256) fail(`Master is only ${srcW}px wide — supply at least 256, ideally 1024.`)
console.log(`\nMaster: ${src}  (${srcW}px)${dryRun ? '   (dry run)' : ''}\n`)

const tmp = mkdtempSync(join(tmpdir(), 'sip-icons-'))

// lanczos, not sips' default: these are big downscales (1024 -> 32) and the
// difference is visible as mush around the droplet edges at favicon size.
function render(px) {
  const out = join(tmp, `${px}.png`)
  if (!dryRun) {
    execFileSync('ffmpeg', [
      '-v', 'error', '-y',
      '-i', master,
      '-vf', `scale=${px}:${px}:flags=lanczos`,
      '-pix_fmt', 'rgba',
      out,
    ])
  }
  return out
}

const written = []
function place(renderedPath, relDir, name) {
  const dest = join(root, relDir, name)
  if (!dryRun) copyFileSync(renderedPath, dest)
  written.push(`${relDir}/${name}`)
}

for (const [name, px] of Object.entries(SIP_ICON)) {
  const f = render(px)
  for (const d of ICON_DIRS) {
    place(f, d, `sip-icon-${name}.png`)
    place(f, d, `sip-icon-dark-${name}.png`)
  }
  if (name === '64') for (const d of LOGO_DIRS) {
    place(f, d, 'sip-icon-64.png')
    place(f, d, 'sip-icon-dark-64.png')
  }
}

for (const px of PLAIN_ICON) {
  const f = render(px)
  for (const d of ICON_DIRS) place(f, d, `icon${px}.png`)
}

for (const w of written) console.log(`  ${dryRun ? 'would write' : 'wrote'} ${w}`)
console.log(`\n${dryRun ? 'Would write' : 'Wrote'} ${written.length} files.\n`)
if (!dryRun) {
  console.log('Then rebuild the extension package so the zip carries them:')
  console.log('  npm run release -- current      (same version, fresh zip)\n')
}
