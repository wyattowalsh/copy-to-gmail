# npm Publishing

`copy-to-gmail` is designed to run from packaged static assets with no Vite server at runtime.

## Package Shape

The npm package includes:

- `bin/copy-to-gmail.mjs` for the CLI.
- `dist/` production assets.
- `README.md`, `CHANGELOG.md`, `LICENSE`, and `docs/`.
- `package.json` metadata.

It intentionally excludes source files, tests, coverage output, local state, and dependency folders.

## Build And Pack

`prepack` runs `pnpm build`, so normal `npm pack` and `npm publish` commands rebuild the app first.

```sh
pnpm build
npm pack --dry-run --json
```

Review the dry-run JSON for unexpected files and package size changes.

## Dry-Run Publish

```sh
npm publish --dry-run
```

The dry-run should complete without creating a registry release.

## Runtime Contract

The package CLI:

- Serves only files under packaged `dist/`.
- Falls back to `dist/index.html` for app routes.
- Sets `X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
- Picks a random high local port when `--port` and `PORT` are not set.
- Rejects non-loopback hosts.
- Supports `--no-open`, `--version`, and `--help`.

## Publishing

After all checks pass and the changelog version is dated:

```sh
npm publish
```

Do not publish from a dirty worktree unless the dirty files are the intentional release changes.
