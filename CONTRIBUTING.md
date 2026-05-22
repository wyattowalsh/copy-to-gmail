# Contributing

## Setup

```sh
pnpm install
pnpm dev
```

The development server binds to `127.0.0.1`; set `PORT` when you need a specific local port.

## Quality Gates

Run the full app gate before proposing changes:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

Use `pnpm format` to apply Prettier formatting.

## Release Checks

Distribution changes should also pass:

```sh
npm pack --dry-run --json
npm publish --dry-run
```

See `docs/release-checklist.md` and `docs/npm-publishing.md` for the complete package validation flow.

## Safety Rules

- Keep the app local-only and loopback-bound.
- Do not add Gmail API access, sending behavior, telemetry, or external draft upload paths.
- Treat theme JSON as data only; do not accept arbitrary CSS selectors or executable values.
- Preserve sanitizer coverage when adding editor, preview, clipboard, or import/export behavior.
- Keep package runtime dependencies minimal because `npx copy-to-gmail` should start from packaged assets.

## Skill Assets

Changes under `skills/` are skill-definition changes. Validate them with the commands documented in the relevant `SKILL.md` and update evals when dispatch behavior changes.
