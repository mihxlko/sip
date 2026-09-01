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
| **extension** (`apps/extension`) | `npm run release` builds a zip; a human uploads it | **yes** |

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

## The manual step

The script prints it, and it is genuinely manual:

1. [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole) → the SIP item
   (extension ID `dcipoicfooachjhpchgficlmbkbhogbf`)
2. **Package → Upload new package** → `releases/sip-vX.Y.Z.zip`
3. Submit for review (review typically takes hours to a few days)

Claude cannot do this — it needs a signed-in browser session. Hand over the
absolute path to the zip and stop there.

**It is automatable, but not for free.** The Chrome Web Store API can upload and
publish over HTTPS with an OAuth2 refresh token. The one-time setup is a Google
Cloud project, the Web Store API enabled, an OAuth client, and a refresh token
generated through a consent screen — all of which need the user's browser and
Google account, and produce secrets that must stay out of the repo. Worth doing
if releases are frequent; not worth it for a few a year. Offer it, explain that
cost, and let the user decide — do not start the credential setup unprompted.

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
