#!/usr/bin/env node
// One-time Chrome Web Store API authorisation.
//
//   npm run cws:auth
//
//   npm run cws:auth -- --local     (rare — see below)
//
// Exchanges a Google OAuth consent for a REFRESH token and writes it to
// ~/.config/sip/cws-credentials.json. Run ONCE PER MACHINE, not once per
// checkout: the token lives in HOME, so every Conductor worktree and every
// future clone of this repo picks it up, and archiving a workspace does not
// take it with them.
//
// --local writes <repo>/.cws-credentials.json instead (gitignored). That is
// only for deliberately using a different Google account in one checkout;
// publish.js prefers a local file over the user-level one when both exist.
//
// WHY A LOOPBACK SERVER
//   Google killed the copy-paste "out of band" flow (urn:ietf:wg:oauth:2.0:oob)
//   in 2022, so a desktop OAuth client has to receive its code on a real
//   redirect. This spins up a throwaway HTTP server on 127.0.0.1, hands you a
//   URL, and catches the redirect Google makes back to it. Nothing is exposed
//   beyond localhost, and the server closes the moment the code arrives.
//
// PREREQUISITES — the ship-extension skill has the click-by-click version.
//   A Google Cloud project with the Chrome Web Store API enabled, and an OAuth
//   client of type "Desktop app". You need its client ID and secret.

import { createServer } from 'node:http'
import { createInterface } from 'node:readline/promises'
import { existsSync, readFileSync, writeFileSync, chmodSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const local = process.argv.slice(2).includes('--local')
const CREDS = local
  ? join(root, '.cws-credentials.json')
  : join(
      process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
      'sip',
      'cws-credentials.json',
    )
const shown = CREDS.replace(homedir(), '~')
const SCOPE = 'https://www.googleapis.com/auth/chromewebstore'
const PORT = 8976 // arbitrary, just has to match the redirect URI you register

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

const rl = createInterface({ input: process.stdin, output: process.stdout })

// Existing credentials are only replaced deliberately — re-running this by
// accident should not cost you a working token.
let existing = {}
if (existsSync(CREDS)) {
  existing = JSON.parse(readFileSync(CREDS, 'utf8'))
  if (existing.refresh_token) {
    const go = await rl.question(
      `${shown} already holds a refresh token.\nReplace it? [y/N] `,
    )
    if (go.trim().toLowerCase() !== 'y') {
      console.log('Left it alone.')
      process.exit(0)
    }
  }
}

console.log(`
Chrome Web Store API — one-time authorisation
─────────────────────────────────────────────
Writing to: ${shown}
${local ? '(--local: this checkout only)' : '(covers every worktree and clone on this machine)'}

If you have not created the OAuth client yet, stop and do that first:

  1. https://console.cloud.google.com/projectcreate  — any name
  2. APIs & Services → Library → "Chrome Web Store API" → Enable
  3. APIs & Services → OAuth consent screen → External →
     fill the required fields → SAVE, then set Publishing status to
     "In production"  ← IMPORTANT, see the note at the end
  4. APIs & Services → Credentials → Create credentials →
     OAuth client ID → Application type: "Desktop app"
  5. Copy the client ID and client secret
`)

const clientId = (await rl.question('Client ID: ')).trim()
const clientSecret = (await rl.question('Client secret: ')).trim()
if (!clientId || !clientSecret) fail('Both a client ID and secret are required.')

const redirectUri = `http://127.0.0.1:${PORT}`
const authUrl =
  'https://accounts.google.com/o/oauth2/v2/auth?' +
  new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    // offline + consent is what actually returns a refresh_token. Without
    // prompt=consent Google omits it on every authorisation after the first,
    // and you get an access token that dies in an hour.
    access_type: 'offline',
    prompt: 'consent',
  }).toString()

// Wait for Google to redirect back with ?code=...
const code = await new Promise((resolvePromise, rejectPromise) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, redirectUri)
    if (url.pathname !== '/') {
      res.writeHead(404).end()
      return
    }
    const err = url.searchParams.get('error')
    const got = url.searchParams.get('code')
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      `<!doctype html><meta charset="utf-8"><title>SIP</title>
       <body style="font:16px/1.5 system-ui;padding:48px;max-width:40em">
       <h1 style="font-size:20px">${err ? 'Authorisation failed' : 'Authorised'}</h1>
       <p>${err ? err : 'You can close this tab and go back to the terminal.'}</p>`,
    )
    server.close()
    err ? rejectPromise(new Error(err)) : resolvePromise(got)
  })
  server.on('error', e =>
    rejectPromise(
      new Error(
        e.code === 'EADDRINUSE'
          ? `port ${PORT} is busy — close whatever is on it and re-run`
          : e.message,
      ),
    ),
  )
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`
Add this EXACT redirect URI to the OAuth client (Credentials → your client →
Authorised redirect URIs) if it is not there already:

  ${redirectUri}

Then open this URL and approve. Google will warn the app is unverified —
that is expected for a personal client; choose Advanced → Go to … (unsafe).

  ${authUrl}
`)
    // Best-effort convenience; the URL is printed above regardless.
    execFile('open', [authUrl], () => {})
  })
})

rl.close()

const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: redirectUri,
  }),
})

const token = await tokenRes.json()
if (!tokenRes.ok) fail(`Token exchange failed: ${JSON.stringify(token, null, 2)}`)
if (!token.refresh_token) {
  fail(
    'Google returned no refresh_token. That happens when the consent was a\n' +
      '  re-authorisation — revoke the app at https://myaccount.google.com/permissions\n' +
      '  and run this again.',
  )
}

mkdirSync(dirname(CREDS), { recursive: true, mode: 0o700 })
writeFileSync(
  CREDS,
  JSON.stringify(
    {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      // Only written if it was already overridden — the item id is a repo
      // constant in publish.js, so the same token serves several extensions.
      ...(existing.item_id ? { item_id: existing.item_id } : {}),
    },
    null,
    2,
  ) + '\n',
)
chmodSync(CREDS, 0o600)

console.log(`
✓ Wrote ${shown} (chmod 600)

  You can now run:  npm run cws:publish

  NOTE — if you left the OAuth consent screen in "Testing" rather than
  "In production", Google expires this refresh token after 7 DAYS and
  publishing will start failing with invalid_grant. Switch it to production
  and re-run this once to get a token that does not expire.
`)
