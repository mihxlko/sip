#!/usr/bin/env node
// Upload (and optionally submit) a SIP release to the Chrome Web Store.
//
//   npm run cws:publish                    -> upload the newest releases/*.zip as a DRAFT
//   npm run cws:publish -- 2.0.1           -> upload that specific version
//   npm run cws:publish -- --submit        -> upload AND submit for review
//   npm run cws:publish -- --status        -> just report the store's current state
//   npm run cws:publish -- --dry-run       -> resolve everything, send nothing
//
// NOTE the `--`: npm swallows flags it recognises before they reach the script.
//
// Uploading is reversible — a draft sits on the item until you submit it, and
// re-uploading replaces it. SUBMITTING IS NOT: it enters Google's review queue
// and the version number is burned whatever the outcome. That is why --submit
// is opt-in rather than the default.
//
// WHERE CREDENTIALS COME FROM, in order — first hit wins:
//
//   1. env vars CWS_CLIENT_ID / CWS_CLIENT_SECRET / CWS_REFRESH_TOKEN   (CI)
//   2. $SIP_CWS_CREDENTIALS                                (explicit override)
//   3. <repo>/.cws-credentials.json                    (per-checkout override)
//   4. ~/.config/sip/cws-credentials.json                        (the default)
//
// 4 is where `npm run cws:auth` writes, and it is the reason authorising once
// covers every Conductor worktree and every future clone: the token lives in
// the HOME directory, not in a checkout that gets archived. 3 exists only for
// the case of deliberately using a different Google account in one checkout.
//
// The item id is NOT a secret and is not part of that resolution — it is a
// repo constant below, overridable per credentials file for a second item.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL_CREDS = join(root, '.cws-credentials.json')
const USER_CREDS = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
  'sip',
  'cws-credentials.json',
)
const RELEASES = join(root, 'releases')

// The SIP extension on the Chrome Web Store. Public — it is in the store URL
// and in apps/web/src/links.ts.
const DEFAULT_ITEM_ID = 'dcipoicfooachjhpchgficlmbkbhogbf'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const submit = args.includes('--submit')
const statusOnly = args.includes('--status')
const versionArg = args.find(a => !a.startsWith('-'))

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

// --- credentials ----------------------------------------------------------

function loadCreds() {
  if (process.env.CWS_CLIENT_ID && process.env.CWS_CLIENT_SECRET && process.env.CWS_REFRESH_TOKEN) {
    return {
      source: 'environment',
      client_id: process.env.CWS_CLIENT_ID,
      client_secret: process.env.CWS_CLIENT_SECRET,
      refresh_token: process.env.CWS_REFRESH_TOKEN,
      item_id: process.env.CWS_ITEM_ID ?? DEFAULT_ITEM_ID,
    }
  }

  const path = [process.env.SIP_CWS_CREDENTIALS, LOCAL_CREDS, USER_CREDS].find(
    p => p && existsSync(p),
  )
  if (!path) {
    fail(
      'No credentials. Run `npm run cws:auth` once — it stores the token in\n' +
        `  ${USER_CREDS.replace(homedir(), '~')}, so it works from every\n` +
        '  worktree and survives archiving this one.',
    )
  }

  let c
  try {
    c = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    // Node's JSON errors embed the offending text verbatim, newlines and all,
    // which shreds the message when it is printed as one line.
    const why = e.message.replace(/\s+/g, ' ').slice(0, 120)
    fail(`${path} is not valid JSON — re-run \`npm run cws:auth\`.\n  (${why})`)
  }
  for (const k of ['client_id', 'client_secret', 'refresh_token']) {
    if (!c[k]) fail(`${path} is missing "${k}" — re-run \`npm run cws:auth\`.`)
  }
  return { ...c, item_id: c.item_id ?? DEFAULT_ITEM_ID, source: path.replace(homedir(), '~') }
}

async function accessToken(c) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.client_id,
      client_secret: c.client_secret,
      refresh_token: c.refresh_token,
      grant_type: 'refresh_token',
    }),
  })
  const json = await res.json()
  if (!res.ok) {
    // The overwhelmingly common cause, worth naming rather than dumping JSON.
    if (json.error === 'invalid_grant') {
      fail(
        'Google rejected the refresh token (invalid_grant).\n' +
          '  Usually one of:\n' +
          '   • the OAuth consent screen is still in "Testing", which expires\n' +
          '     refresh tokens after 7 days — set it to "In production"\n' +
          '   • access was revoked at https://myaccount.google.com/permissions\n' +
          '  Either way: fix it, then re-run `npm run cws:auth`.',
      )
    }
    fail(`Token refresh failed: ${JSON.stringify(json, null, 2)}`)
  }
  return json.access_token
}

// --- which zip --------------------------------------------------------------

function pickZip() {
  if (!existsSync(RELEASES)) fail('No releases/ directory — run `npm run release` first.')
  if (versionArg) {
    const p = join(RELEASES, `sip-v${versionArg}.zip`)
    if (!existsSync(p)) fail(`${p.replace(root + '/', '')} does not exist.`)
    return p
  }
  const zips = readdirSync(RELEASES)
    .filter(f => /^sip-v\d+\.\d+\.\d+\.zip$/.test(f))
    .map(f => ({ f, t: statSync(join(RELEASES, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  if (!zips.length) fail('No sip-vX.Y.Z.zip in releases/ — run `npm run release` first.')
  return join(RELEASES, zips[0].f)
}

// --- api --------------------------------------------------------------------

const API = 'https://www.googleapis.com/chromewebstore/v1.1/items'
const UPLOAD = 'https://www.googleapis.com/upload/chromewebstore/v1.1/items'

async function getStatus(token, itemId) {
  const res = await fetch(`${API}/${itemId}?projection=DRAFT`, {
    headers: { authorization: `Bearer ${token}`, 'x-goog-api-version': '2' },
  })
  return { ok: res.ok, body: await res.json() }
}

// --- go ---------------------------------------------------------------------

const creds = loadCreds()

if (statusOnly) {
  const token = await accessToken(creds)
  const { ok, body } = await getStatus(token, creds.item_id)
  if (!ok) fail(`Status check failed: ${JSON.stringify(body, null, 2)}`)
  console.log(`\nItem ${creds.item_id}   (auth: ${creds.source})`)
  console.log(`  upload state : ${body.uploadState}`)
  console.log(`  crx version  : ${body.crxVersion ?? '(none)'}`)
  if (body.itemError?.length) {
    console.log('  errors:')
    for (const e of body.itemError) console.log(`   • ${e.error_detail ?? JSON.stringify(e)}`)
  }
  console.log()
  process.exit(0)
}

const zipPath = pickZip()
const zip = readFileSync(zipPath)
const localVersion = /sip-v(\d+\.\d+\.\d+)\.zip$/.exec(zipPath)[1]

console.log(`
Chrome Web Store
  item     ${creds.item_id}
  auth     ${creds.source}
  package  ${zipPath.replace(root + '/', '')}  (${(zip.length / 1e6).toFixed(1)} MB)
  version  ${localVersion}
  action   ${submit ? 'upload AND submit for review' : 'upload as draft only'}${dryRun ? '   (dry run)' : ''}
`)

if (dryRun) {
  console.log('Dry run — nothing sent.\n')
  process.exit(0)
}

const token = await accessToken(creds)

// Guard against burning a version number on a zip that is already live.
const pre = await getStatus(token, creds.item_id)
if (pre.ok && pre.body.crxVersion === localVersion) {
  fail(
    `The store already has ${localVersion}. Chrome will not accept a reused\n` +
      '  version — bump first with `npm run release -- patch`.',
  )
}

console.log('Uploading…')
const upRes = await fetch(`${UPLOAD}/${creds.item_id}`, {
  method: 'PUT',
  headers: {
    authorization: `Bearer ${token}`,
    'x-goog-api-version': '2',
    'content-type': 'application/zip',
  },
  body: zip,
})
const up = await upRes.json()

if (!upRes.ok || up.uploadState === 'FAILURE') {
  const details = (up.itemError ?? []).map(e => `   • ${e.error_detail ?? JSON.stringify(e)}`)
  fail(`Upload failed (${up.uploadState ?? upRes.status}):\n${details.join('\n') || JSON.stringify(up, null, 2)}`)
}
console.log(`✓ Uploaded — draft is now ${up.uploadState}\n`)

if (!submit) {
  console.log('Left as a draft. Review it in the dashboard, then either:')
  console.log('  npm run cws:publish -- --submit        (submit for review)')
  console.log('  or hit Submit in the Developer Dashboard\n')
  process.exit(0)
}

console.log('Submitting for review…')
const pubRes = await fetch(`${API}/${creds.item_id}/publish?publishTarget=default`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${token}`,
    'x-goog-api-version': '2',
    'content-length': '0',
  },
})
const pub = await pubRes.json()
if (!pubRes.ok) fail(`Publish failed: ${JSON.stringify(pub, null, 2)}`)

console.log(`✓ Submitted — status: ${(pub.status ?? []).join(', ')}`)
for (const d of pub.statusDetail ?? []) console.log(`  ${d}`)
console.log('\nGoogle review usually takes hours to a few days.\n')
