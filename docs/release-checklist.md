# Release Checklist

Use this checklist before publishing `copy-to-gmail`.

## Preflight

- Confirm `package.json` has the intended `version`, `bin`, `files`, `license`, repository, and engine metadata.
- Confirm `bin/copy-to-gmail.mjs` binds only to `127.0.0.1` and rejects other hosts.
- Confirm `dist/` is generated from the current source with `pnpm build`.
- Confirm no secrets, tokens, draft data, coverage output, or local state files are included in the package.
- If validating Gmail sync, use a test OAuth client and confirm refresh credentials stay in Keychain or the permission-restricted app data fallback, never in browser storage or exported draft JSON.

## Required Commands

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
npm pack --dry-run --json
npm publish --dry-run
```

## Tarball Smoke

Create the package in a temporary directory, install it into a temporary project, and launch the CLI without opening a browser:

```sh
PACK_DIR="$(mktemp -d)"
npm pack --pack-destination "$PACK_DIR"
SMOKE_DIR="$(mktemp -d)"
npm install --prefix "$SMOKE_DIR" "$PACK_DIR"/copy-to-gmail-*.tgz
node "$SMOKE_DIR/node_modules/.bin/copy-to-gmail" --port 48237 --no-open
```

In another terminal, verify the local server responds:

```sh
curl --fail --max-time 5 http://127.0.0.1:48237/
```

Stop the smoke server with `Ctrl+C`.

## Manual Browser Check

- Start the package CLI with a known port.
- Open the printed local URL.
- Switch between visual and source modes.
- Apply a custom theme JSON and reset to a preset.
- Open the preview drawer and check rendered, source, and plain-text views.
- Click `Copy for Gmail`, paste into Gmail compose with Plain text mode off, and review formatting and links.
- With no OAuth config, confirm the Gmail panel stays local-only and the existing copy/export/import flow still works.
- With test OAuth config, connect one Gmail account, load drafts, create a draft, update the linked draft, trigger autosync with a subject edit, open Gmail Drafts, disconnect, and confirm local editing still works afterward.
- Reproduce a conflict by changing the same draft outside the app, then verify Replace Local, Overwrite Gmail, Save New Gmail Draft Version, and Cancel preserve the documented behavior.
- Save a local template, add a signature, create a variable set, export the library bundle, re-import it, and confirm no credentials or Gmail fingerprints appear in the JSON.
- Enable Gmail signature import only during the signature import flow and confirm the extra Gmail settings scope is not requested during the initial draft-sync connect.

## Release Notes

- Update `CHANGELOG.md` with the shipped version and date.
- Ensure `README.md` examples match the final CLI and package behavior.
- If skill files changed, run the validation commands documented in `skills/gmail-composer-drafter/SKILL.md`.
