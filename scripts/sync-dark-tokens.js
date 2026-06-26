#!/usr/bin/env node
/**
 * sync-dark-tokens.js
 *
 * Keeps [data-theme="dark"] as the single source of truth for dark-mode tokens.
 * Reads the declarations from that block and writes them verbatim into the
 * @media (prefers-color-scheme: dark) block — no manual duplication needed.
 *
 * Usage:  node scripts/sync-dark-tokens.js
 */

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const FILES = [
  'packages/ui/src/tokens.css',
  'packages/ui/src/toast-styles.css',
]

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

console.log('Syncing dark tokens…')
for (const file of FILES) syncFile(file)
console.log('Done.')
