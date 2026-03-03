# Releasing Forge

Forge releases currently run from the maintainer's local machine. There is no GitHub Actions publishing flow in Phase 9.

## Prerequisites

- Node 22 or newer
- `NPM_TOKEN` exported for non-interactive release, or local npm authentication available via `npm login`
- A clean git worktree, unless you intentionally override the check
- Release-ready package version already set in `package.json`

## Recommended Release Sequence

One-command release:

```bash
make release v1.0.0
```

This flow will:

- normalize the version (`v1.0.0` becomes `1.0.0`)
- update `package.json`
- verify git status
- prefer `NPM_TOKEN` for npm authentication
- start `npm login` automatically only when `NPM_TOKEN` is missing and npm auth is not already configured
- run build, test, and pack checks
- publish the verified tarball to npm

Dry-run release validation:

```bash
make release-check v1.0.0
```

Equivalent direct command:

```bash
npm run release:local -- v1.0.0 --publish
```

Recommended non-interactive setup:

```bash
export NPM_TOKEN=your_npm_token_here
make release v1.0.0
```

## Optional Flags

- `make release v1.0.0 next --tag next` is not supported; use the direct npm command when you need extra flags
- `npm run release:local -- v1.0.0 --publish --tag next` publishes under a non-`latest` dist-tag
- `--otp 123456` if your npm account requires one-time passwords
- `--login never` disables automatic `npm login`
- `--login always` forces a fresh `npm login` before validation
- `--allow-dirty` only if you intentionally want to bypass the clean-worktree check
- `--keep-tarball` to retain the packed `.tgz` artifact after the command exits
- `--skip-version-bump` keeps the current `package.json` version unchanged

## After Publish

Recommended follow-up steps:

1. Push the version commit and git tag
2. Create or update a GitHub Release note for the published version
3. Verify public install:

```bash
npx forge-ai-assist@latest --version
```

## Failure Handling

- If `NPM_TOKEN` is unset and `npm whoami` fails, the release script will try `npm login` unless you passed `--login never`
- If tests fail, do not publish; fix the issue and rerun the release command
- If publish succeeds but local cleanup fails, the release is already live; remove the tarball manually and proceed with tag/release-note cleanup
