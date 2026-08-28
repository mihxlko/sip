#!/usr/bin/env node
/**
 * sync-dark-tokens.js
 *
 * Two guarantees, both about tokens that exist in more than one place.
 *
 * 1. WITHIN each file: [data-theme="dark"] is the single source of truth for
 *    dark-mode tokens. Its declarations are written verbatim into the
 *    @media (prefers-color-scheme: dark) block.
 *
 * 2. ACROSS files: toast-styles.css inlines a hand-maintained shadow of
 *    tokens.css (it cannot @import — CRXJS drops chained ?inline imports), and
 *    both settings entrypoints load it AFTER tokens.css, so anything that
 *    drifts there silently wins for the whole page. The tokens in
 *    SHARED_TOKENS are copied from tokens.css into toast-styles.css so that
 *    can't happen quietly.
 *
 * Usage:  node scripts/sync-dark-tokens.js           fix in place
 *         node scripts/sync-dark-tokens.js --check   report drift, exit 1, write nothing
 *
 * The --check mode is the point of (2): it turns "keep these in step" from a
 * comment into something CI or a pre-commit hook can actually enforce.
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  'packages/ui/src/tokens.css',
  'packages/ui/src/toast-styles.css',
]

// Cross-file sync: tokens.css is the source, toast-styles.css the shadow.
const SHARED_SOURCE = 'packages/ui/src/tokens.css'
const SHARED_SHADOW = 'packages/ui/src/toast-styles.css'

// Only tokens that MUST be identical in both files. This is intentionally a
// short allow-list rather than "everything shared": the two files legitimately
// diverge in places, and a blanket sync would erase that. --font-sans is here
// because a mismatch is invisible in review and silently gives the toast a
// different typeface from the rest of the app.
const SHARED_TOKENS = ['--font-sans']

const CHECK_ONLY = process.argv.includes('--check')

// Returns { start, end, body } where start = index of '{', end = index of '}'.
function findBlock(css, pattern) {
  const idx = css.search(pattern)
  if (idx === -1) return null

  const openIdx = css.indexOf('{', idx)
  if (openIdx === -1) return null

  let depth = 0
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      if (--depth === 0) return { start: openIdx, end: i, body: css.slice(openIdx + 1, i) }
    }
  }
  return null
}

// Strip the common leading whitespace from all non-blank lines, then
// re-prefix every non-blank line with targetIndent.
function reindent(body, targetIndent) {
  const lines = body.split('\n')

  let minIndent = Infinity
  for (const line of lines) {
    if (line.trim() === '') continue
    const leading = line.match(/^(\s*)/)[1].length
    if (leading < minIndent) minIndent = leading
  }
  if (!isFinite(minIndent)) minIndent = 0

  return lines
    .map(line => (line.trim() === '' ? '' : targetIndent + line.slice(minIndent)))
    .join('\n')
}

function syncFile(rel) {
  const path = resolve(ROOT, rel)
  let css = readFileSync(path, 'utf8')

  // 1. Extract declarations from the explicit dark theme block.
  const darkBlock = findBlock(css, /\[data-theme="dark"\]/)
  if (!darkBlock) throw new Error(`${rel}: [data-theme="dark"] block not found`)

  // 2. Locate the @media block.
  const mediaBlock = findBlock(css, /@media\s*\(prefers-color-scheme:\s*dark\)/)
  if (!mediaBlock) throw new Error(`${rel}: @media prefers-color-scheme:dark block not found`)

  // 3. Find :root:not([data-theme]) inside the media block.
  const mediaBody = mediaBlock.body
  const innerBlock = findBlock(mediaBody, /:root:not\(\[data-theme\]\)/)
  if (!innerBlock) throw new Error(`${rel}: :root:not([data-theme]) inside @media block not found`)

  // 4. Detect the indent of the inner selector (e.g. "  ") and add one level.
  const selectorLine = mediaBody.slice(0, innerBlock.start).split('\n').at(-1) ?? ''
  const selectorIndent = selectorLine.match(/^(\s*)/)[1]
  const declIndent = selectorIndent + '  '

  // 5. Re-indent the dark declarations to match the inner block's depth.
  const reindented = reindent(darkBlock.body, declIndent)

  // 6. Rebuild: replace inner block body, then splice back into full CSS.
  // selectorIndent is re-added before the closing } so it stays properly indented.
  const newMediaBody =
    mediaBody.slice(0, innerBlock.start + 1) +
    reindented +
    selectorIndent +
    mediaBody.slice(innerBlock.end)

  const newCss =
    css.slice(0, mediaBlock.start + 1) +
    newMediaBody +
    css.slice(mediaBlock.end)

  if (newCss === css) {
    console.log(`  (no change) ${rel}`)
  } else {
    writeFileSync(path, newCss, 'utf8')
    console.log(`  ✓ synced    ${rel}`)
  }
}

// ─── cross-file shared tokens ────────────────────────────────────────────────

// Matches a single custom-property declaration, capturing indent / value
// separately so a rewrite preserves the alignment already in the file.
function tokenPattern(name) {
  return new RegExp(`^([ \\t]*)(${name})\\s*:\\s*([^;\\n]*);`, 'gm')
}

// Every declaration of `name` in `css`. More than one is an error rather than
// a "last wins" guess — duplicates in these files have caused real bugs.
function findDeclarations(css, name) {
  return [...css.matchAll(tokenPattern(name))].map(m => ({
    indent: m[1], value: m[3].trim(), index: m.index, full: m[0],
  }))
}

function readSharedToken(css, name, rel) {
  const found = findDeclarations(css, name)
  if (found.length === 0) throw new Error(`${rel}: ${name} not found`)
  if (found.length > 1)   throw new Error(`${rel}: ${name} declared ${found.length}× — expected exactly one`)
  return found[0]
}

function syncSharedTokens() {
  const sourcePath = resolve(ROOT, SHARED_SOURCE)
  const shadowPath = resolve(ROOT, SHARED_SHADOW)
  const sourceCss  = readFileSync(sourcePath, 'utf8')
  let   shadowCss  = readFileSync(shadowPath, 'utf8')

  const drifted = []

  for (const name of SHARED_TOKENS) {
    const src = readSharedToken(sourceCss, name, SHARED_SOURCE)
    const dst = readSharedToken(shadowCss, name, SHARED_SHADOW)

    if (src.value === dst.value) {
      console.log(`  (in step)   ${name}`)
      continue
    }

    drifted.push({ name, expected: src.value, actual: dst.value })
    if (CHECK_ONLY) continue

    shadowCss =
      shadowCss.slice(0, dst.index) +
      `${dst.indent}${name}: ${src.value};` +
      shadowCss.slice(dst.index + dst.full.length)
  }

  if (!drifted.length) return 0

  for (const d of drifted) {
    console.log(`\n  DRIFT  ${d.name}`)
    console.log(`    ${SHARED_SOURCE}\n      ${d.expected}`)
    console.log(`    ${SHARED_SHADOW}\n      ${d.actual}`)
  }

  if (CHECK_ONLY) {
    console.log(`\n  ✗ ${drifted.length} token(s) out of step. Run without --check to fix.`)
    return drifted.length
  }

  writeFileSync(shadowPath, shadowCss, 'utf8')
  console.log(`\n  ✓ rewrote   ${SHARED_SHADOW} from ${SHARED_SOURCE}`)
  return 0
}

// A malformed file is a failure like any other — report it the way the drift
// report reads, not as an uncaught stack trace. This runs in CI.
try {
  if (!CHECK_ONLY) {
    console.log('Syncing dark tokens…')
    for (const file of FILES) syncFile(file)
  }

  console.log(CHECK_ONLY ? 'Checking shared tokens…' : 'Syncing shared tokens…')
  if (syncSharedTokens() > 0) process.exit(1)
} catch (err) {
  console.error(`\n  ✗ ${err.message}`)
  process.exit(1)
}

console.log('Done.')
