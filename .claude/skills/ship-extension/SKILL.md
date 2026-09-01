---
name: ship-extension
description: "Cut a SIP release — bump the version, build and zip the Chrome extension, verify the package actually contains the change, and land the bump on main. Use whenever the user wants to ship, release, cut a version, publish to the Chrome Web Store, or asks whether something that was merged has reached users. Covers the `npm run release` argument gotchas, what is and is not automated, how to prove the zip is correct before uploading, and the one step that still needs a human. Triggers on: ship it, cut a release, release the extension, publish, new version, bump the version, upload to the web store, Chrome Web Store, did that ship, is it live, package the extension, make a zip."
metadata:
  short-description: SIP release process — version, package, verify, publish
---

# Shipping SIP

Two surfaces ship from this repo and **they ship differently**:

| | how it ships | needs a human? |
|---|---|---|
| **web app** (`apps/web`) | Vercel deploys production automatically on merge to `main` | no |
| **extension** (`apps/extension`) | `npm run release` builds a zip, `npm run cws:publish` uploads it | only for the first auth |

So "merged" means the web app is live and the extension is not. When asked
whether something shipped, check which surface it was.

Verify a web deploy rather than assuming:

```bash
gh api repos/mihxlko/sip/deployments --jq '.[0] | .environment + " " + .created_at'
```

Compare that timestamp to the merge — a production entry within a minute or so
of it means the merge deployed.

## The release command

```bash
npm run release -- 2.0.1          # explicit version (clearest — prefer this)
npm run release -- patch          # 2.0.0 -> 2.0.1
npm run release -- minor          # 2.0.0 -> 2.1.0
npm run release -- current        # re-pack the CURRENT version, no bump
npm run release -- patch --dry-run
```

**The `--` is not optional.** npm swallows `--dry-run` and words it recognises
before they reach the script. `npm run release --dry-run` silently does a real
release.

One command does all of: bump `manifest.json` + both `package.json` files +
`package-lock.json`, build the extension, and zip `apps/extension/dist` into
`releases/sip-vX.Y.Z.zip` with `manifest.json` at the zip root — the layout the
Web Store requires. There is nothing to add around it; don't wrap it in another
script.

`releases/` is gitignored, so the zip stays local to whichever workspace ran the
command. Give the user the absolute path — in a Conductor worktree it is *not*
under `~/code/sip`.

## Icons

`npm run gen-icons -- <master.png>` regenerates all 28 icon files from one
master (use 1024px). Do not resize by hand — the two families use different
conventions and the filenames do not say which:

- `sip-icon-N.png` is **2N** px — 16→32, 32→64, 64→128, 128→256
- `iconN.png` is **N** px — 16→16, 32→32, 48→48, 128→128

`sip-icon-dark-*.png` gets identical bytes to the light set: `platform.ts` in
both apps picks the dark name under a dark theme, so those files must keep
existing even when the art has no dark variant.

After regenerating, **rebuild the package or the zip still has the old art**:
`npm run release -- current` re-zips at the same version — correct as long as
that version has not been uploaded yet. If it has, bump instead.

## Picking the version

Chrome rejects any version that is not strictly greater than the live one, and
a version can never be reused — a bad bump is unrecoverable, you can only go up.

- **patch** — visual fixes, restyles, copy. A restyled control is a patch.
- **minor** — new user-facing capability or a settings surface change.
- Branch names are not versions. `v2.1.0/polish` shipped as **2.0.1**; ask
  rather than inferring from the branch.

## Before running it

1. On `main`, or on a branch that has `main` merged in — the build packages the
   working tree, not `origin/main`. A stale branch ships stale code.
2. Working tree clean. The script warns on a dirty tree but does not stop;
   uncommitted edits land in the zip.
3. `npm run build --workspace @sip/extension` passes.

## After running it — prove the zip is right

The zip is the artifact users get, and a wrong one is only discoverable after
review. Three checks, all cheap:

```bash
unzip -p releases/sip-v2.0.1.zip manifest.json | grep '"version"'   # the new version
unzip -l releases/sip-v2.0.1.zip | head -5                          # manifest at ROOT, no dist/ wrapper
unzip -p releases/sip-v2.0.1.zip assets/settings-*.css | grep -c '<the change>'
```

That third one is the one that matters: grep the built bundle for something
only the new change would produce — a class, a custom property, a magic number.
It is the only step that proves the thing being shipped is in the thing being
uploaded. Also grep for anything that was *removed* and expect `0`.

## Land the bump

The version files are modified but not committed. On a branch:

```bash
git commit -am "Release v2.0.1"
git push origin <branch>
gh pr create --base main --title "Release v2.0.1" --body-file <file>
gh pr merge --merge          # add --delete-branch only if the user wants it gone
```

Check `gh pr checks` before merging — Vercel runs on every PR.

## Uploading to the store

```bash
npm run cws:publish                 # upload the newest zip as a DRAFT
npm run cws:publish -- 2.0.1        # a specific version
npm run cws:publish -- --submit     # upload AND submit for review
npm run cws:publish -- --status     # what the store currently has
npm run cws:publish -- --dry-run    # resolve everything, send nothing
```

**Upload and submit are not the same risk.** An uploaded draft sits on the item
and can be replaced by uploading again — reversible. Submitting enters Google's
review queue and burns the version number whatever the outcome — not reversible,
and a version can never be reused. So the default is draft-only and `--submit`
is opt-in. Do not pass `--submit` unless the user asked to submit, not merely to
upload.

The script refuses to upload a version the store already has, rather than
letting Chrome reject it after the transfer.

### If it has never been authorised on this machine

`npm run cws:auth`, **once per machine — not once per checkout.** It writes
`~/.config/sip/cws-credentials.json`, so every Conductor worktree and every
future clone picks the same token up, and archiving a workspace does not take
it away. Needs a Google Cloud project with the Chrome Web Store API enabled and
a **Desktop app** OAuth client; the script prints the click path and then runs
a loopback OAuth flow.

**"Desktop app" is a question about the client, not the product.** The client
is the Node CLI in `scripts/`, so it is a desktop/native client — this has
nothing to do with SIP being a web app and a Chrome extension, and nothing to
do with where the repo lives. Two wrong answers are tempting:

- *"Chrome extension"* — for an extension that calls Google APIs itself via
  `chrome.identity`. SIP's extension never talks to Google.
- *"Web application"* — for a server with a public HTTPS redirect, and it would
  put a web client secret in a local CLI.

A Desktop client usually shows **no redirect-URI field at all**; loopback
addresses are permitted implicitly for that type. Nothing to configure and
nothing missing. Only if the console does show an "Authorised redirect URIs"
box does `http://127.0.0.1:8976` need to go in it.

Credential resolution, first hit wins — `cws:publish` prints which one it used
on an `auth` line, so start there when something authenticates unexpectedly:

1. env `CWS_CLIENT_ID` / `CWS_CLIENT_SECRET` / `CWS_REFRESH_TOKEN` (CI)
2. `$SIP_CWS_CREDENTIALS` (explicit path)
3. `<repo>/.cws-credentials.json` — per-checkout override, written by
   `npm run cws:auth -- --local`. Only for deliberately using a different
   Google account in one checkout.
4. `~/.config/sip/cws-credentials.json` — the default

Claude cannot do the consent step — it needs the user's browser and Google
account. Being signed into the Web Store dashboard does **not** help; Claude has
no access to browser sessions or cookies.

**The 7-day trap.** If the OAuth consent screen is left in "Testing" rather than
"In production", Google expires the refresh token after 7 days and every publish
then fails with `invalid_grant`. `publish.js` names this explicitly when it sees
that error. The fix is to switch the consent screen to production and re-run
`npm run cws:auth`.

### What the token can actually do

The scope is `https://www.googleapis.com/auth/chromewebstore`, and it is worth
being precise about what that covers, because it is broader than it looks:

- It authorises a **Google account**, not a repo and not a workspace. There is
  no such thing as "authorising the repo" — OAuth has no concept of it.
- It is **write access to every extension that account can publish**, not just
  SIP. Which item gets touched is decided by the item id the script sends, not
  by anything Google enforces. The file is the blast radius: keep it 0600, keep
  it out of the repo, and never paste it into a chat or an issue.
- Read-only alternatives exist (`chromewebstore.readonly`) but cannot upload, so
  they are no use here.

If that breadth is uncomfortable, the mitigation is a separate Google account
that owns only this extension — not a narrower scope, because none exists.

### Still manual

Store *listing* changes — description, screenshots, categories — are not covered
by this API path. Those stay in the dashboard. The API only moves packages.

## Known sharp edges

- **The lockfile used to drift.** `release.js` now runs
  `npm install --package-lock-only` after bumping, because `package-lock.json`
  carries the root version in two places and was silently left a version behind
  on every release (cleaned up by hand once already, in `ed66991`). If a bump
  ever lands with the lock still on the old version, that call is the thing that
  broke.
- **`.context/` is only ignored via `.git/info/exclude`**, which is per-clone and
  not committed. It can hold large attachments. Do not `git add -A` blind on a
  fresh clone.
- The zip is ~13 MB, mostly self-hosted fonts and logo PNGs. That is expected,
  and far under the Web Store limit.
- **`npm publish` is not `npm run cws:publish`.** The store script is namespaced
  `cws:` on purpose: npm reserves `publish` as a lifecycle hook, and a script by
  that name can be triggered by the registry command rather than by you.
