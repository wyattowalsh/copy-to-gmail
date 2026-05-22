# Copy to Gmail

Local Gmail-ready drafting studio for composing rich email, validating paste safety, previewing sanitized output, copying a `text/html` plus `text/plain` clipboard payload into Gmail, and optionally syncing with Gmail Drafts.

Copy to Gmail runs on your machine. Gmail API access is optional and only starts after you connect a Google account through the local CLI server. The app does not send email, read your inbox, manage labels, or collect telemetry.

## Quick Start

Run the packaged app with `npx`:

```sh
npx copy-to-gmail
```

The CLI serves the production build from `dist/`, binds to `127.0.0.1`, chooses a random high port by default, prints the local URL, and opens your browser.

Useful CLI options:

```sh
copy-to-gmail --no-open
copy-to-gmail --port 48237 --no-open
copy-to-gmail --version
copy-to-gmail --help
```

`--host` exists only as a guardrail: any host other than `127.0.0.1` is rejected to protect draft content.

## Local Development

Prerequisites:

- Node.js `>=20.19.0`.
- `pnpm@10.13.1`, pinned through `packageManager`.
- Gmail compose with Plain text mode off before pasting.

Install and run Vite locally:

```sh
pnpm install
pnpm dev
```

Vite dev and preview bind to `127.0.0.1`; `PORT` defaults to `3333` for repo development:

```sh
PORT=4444 pnpm dev
```

Preview the packaged server from a production build:

```sh
pnpm build
pnpm start -- --no-open
```

## Gmail Workflow

1. Write visually, or switch to `Source` mode to paste/edit body HTML.
2. Add optional Subject, To, Cc, and Bcc metadata when you want draft JSON or Gmail Draft sync to carry full compose details.
3. Check the Gmail readiness panel for content, recipient, clipboard, link, and paste-mode guidance.
4. Use `Open preview drawer` to inspect rendered, plain-text, and sanitized source views.
5. Click `Copy for Gmail`.
6. Paste into Gmail compose with Plain text mode off.
7. Review links and final formatting in Gmail before sending.

The app only writes to the system clipboard after a user click.

## Optional Gmail Draft Sync

Gmail sync is local-server backed and disabled by default. The browser UI talks only to same-origin `/api/gmail/*` endpoints served by `copy-to-gmail`; refresh credentials stay server-side and are never written to draft JSON, browser localStorage, logs, or export bundles.

To enable Gmail sync for local use, provide your own Google OAuth client configuration before starting the packaged server:

```sh
COPY_TO_GMAIL_GOOGLE_CLIENT_ID="your-client-id" \
COPY_TO_GMAIL_GOOGLE_CLIENT_SECRET="your-client-secret" \
copy-to-gmail --no-open
```

Alternatively, set `COPY_TO_GMAIL_GOOGLE_OAUTH_CONFIG` to a JSON file containing `clientId` and optional `clientSecret`, or place `google-oauth.json` in the app data directory.

Requested initial scopes:

- `openid` and `email`, to show the connected account email in the UI.
- `https://www.googleapis.com/auth/gmail.compose`, to create, load, and update Gmail drafts.

Token storage:

- macOS uses Keychain first under the `copy-to-gmail.gmail` service name.
- If Keychain is unavailable, the CLI falls back to a permission-restricted `gmail-token.json` file in the app data directory.
- App data defaults to `~/Library/Application Support/copy-to-gmail` on macOS, `%LOCALAPPDATA%\copy-to-gmail` on Windows, and `$XDG_DATA_HOME/copy-to-gmail` or `~/.local/share/copy-to-gmail` on Linux.

Current sync boundaries:

- The app can connect one Gmail account, list recent Gmail drafts, load a selected draft, create a new Gmail draft, update a linked draft, autosync significant linked-draft edits, resolve remote-change conflicts, and open Gmail Drafts with account-aware links.
- Gmail Drafts are the remote persistence layer; there is no database.
- Local version snapshots for created or updated Gmail drafts are stored as bounded JSON files under the app data directory.
- The local library stores templates, local signatures, imported Gmail signatures, and variable sets in app data. Whole-library and individual template/signature/variable exports are JSON bundles that intentionally exclude credentials, draft snapshots, Gmail fingerprints, and refresh tokens.
- Gmail signature import uses the additional `https://www.googleapis.com/auth/gmail.settings.basic` scope only when the user chooses the Gmail signature import action.
- Gmail sending, inbox reading, arbitrary message search, labels, thread management, and contacts autocomplete are intentionally out of scope.

## Editor Features

- Visual editor powered by `@react-email/editor`.
- Source mode for direct body HTML input.
- Subject and To/Cc/Bcc metadata fields included in versioned local draft JSON and optional Gmail Draft sync.
- Optional linked-draft autosync with fingerprint preflight checks and a conflict panel for Replace Local, Overwrite Gmail, Save New Gmail Draft Version, or Cancel.
- Local template, signature, Gmail-signature, and variable-set library with prompt-based placeholder filling.
- Sanitized preview drawer with rendered, source, and plain-text tabs.
- Toolbelt for plain-text copy, sanitized HTML copy, validation refresh, formatting cleanup, and versioned draft JSON import/export.
- Settings modal for editor defaults, privacy reminders, and local draft recovery preference.
- Theme switcher for light, dark, system, and custom JSON themes.
- Built-in themes including Gmail Clean, Minimal Ink, Warm Paper, Rose Pine, Rose Pine Dawn, Rose Pine Moon, and high contrast variants.

## Theme JSON

Use `Copy theme JSON` to export the active theme, then paste edited JSON in `Settings -> Theme JSON` and click `Apply JSON`.

Theme JSON is data only. It accepts safe color tokens, safe shadow values, safe radius lengths, and `comfortable` or `compact` density. It does not accept arbitrary CSS selectors, scripts, or unsafe `url(...)` values.

Minimal shape:

```json
{
  "version": 1,
  "name": "My Theme",
  "mode": "dark",
  "tokens": {
    "background": "#111111",
    "panel": "#181818",
    "paper": "#202020",
    "ink": "#ffffff",
    "muted": "#cccccc",
    "line": "#333333",
    "lineStrong": "#555555",
    "accent": "#9db7ff",
    "accentStrong": "#ffffff",
    "success": "#72ff9a",
    "warning": "#ffd166",
    "danger": "#ff8fa3",
    "focus": "#ffffff",
    "editorBg": "#000000",
    "editorGrid": "rgb(255 255 255 / 7%)",
    "panelMuted": "#242424",
    "shadow": "0 24px 80px rgb(0 0 0 / 35%)",
    "radius": "24px",
    "density": "comfortable"
  }
}
```

## Clipboard And Safety

`Copy for Gmail` exports the current draft, sanitizes body HTML, derives plain text, and writes both clipboard MIME types when supported:

```text
text/html
text/plain
```

If rich clipboard support is unavailable, the app falls back to a sanitized hidden `contenteditable` copy path. If the browser blocks clipboard access, use the preview drawer to select and copy manually.

The sanitizer removes scripts, event handlers, unsupported active elements, unsafe inline styles, `javascript:` URLs, and relative links. Relative links are removed because Gmail-bound drafts should keep explicit destinations.

Clipboard privacy note: copied email content remains in the operating system clipboard until overwritten and may be visible to other local apps or browser extensions with clipboard access.

## Scripts

```sh
pnpm dev           # Start Vite on 127.0.0.1, PORT defaults to 3333
pnpm start         # Serve the built dist/ app with the package CLI
pnpm preview       # Preview the production build on 127.0.0.1
pnpm typecheck     # TypeScript project references
pnpm lint          # ESLint flat config with type-aware TS rules
pnpm test          # Vitest watch mode
pnpm test:run      # Vitest one-shot test run
pnpm coverage      # Vitest coverage report
pnpm format        # Prettier write
pnpm format:check  # Prettier check
pnpm build         # Typecheck and Vite build
pnpm pack:dry      # npm pack dry-run JSON
```

## Validation

Run before shipping app changes:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
npm pack --dry-run --json
npm publish --dry-run
```

Current automated coverage includes sanitizer behavior, relative-link removal, Gmail readiness checks, rich clipboard/fallback paths, editor labeling, source mode, theme JSON validation, preview drawer rendering, and copy success UI.
Additional coverage includes versioned draft metadata import/export, Gmail draft link construction, deterministic draft fingerprints, recipient warnings, autosync timing rules, template placeholder rendering, and library bundle round trips.

See `docs/release-checklist.md` and `docs/npm-publishing.md` for release-specific checks.

## Troubleshooting

Clipboard permission was blocked:

Use the preview drawer, select the rendered body or plain text, and copy manually. Browser clipboard writes require a user gesture and a secure or local context.

Gmail pasted plain text only:

Turn off Gmail Plain text mode, copy again, then paste into compose.

The CLI says built assets are missing:

Run `pnpm build` first. Published packages include `dist/`; source checkouts need to build it locally.

The editor says it is not ready:

Wait for the editor to finish loading, then try again. The app caches exports through the editor `onReady` and `onUpdate` hooks.

Preview looks different from Gmail:

The drawer previews sanitized body HTML and plain text. Gmail still applies its own paste sanitizer, so always review the pasted compose draft.

Vite warns about large chunks:

`@react-email/editor` and its editor/runtime dependencies dominate the production bundle. This is acceptable for the local-only app; code-splitting the editor is the next optimization if startup size becomes a problem.

## Skill Assets

This repo also includes `skills/gmail-composer-drafter`, a composition-only drafting skill for producing Gmail-ready copy. If you change skill files, run that skill's validation commands in addition to the app validation above.
