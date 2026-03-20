# Releasing Forge

## How It Works

Releases are **fully automated** via [semantic-release](https://github.com/semantic-release/semantic-release). When a PR is merged to `main`, the CI pipeline:

1. Runs build and tests
2. Analyzes commit messages since the last release tag
3. Determines the version bump (or skips if no releasable commits)
4. Updates `package.json`, `CHANGELOG.md`, publishes to npm, creates a GitHub Release
5. Commits the version bump back to `main` with `[skip ci]`

**You never manually set a version number.** The version is derived from your commit messages.

## Version Bump Rules

Forge uses [Conventional Commits](https://www.conventionalcommits.org/). The commit **type** determines the release:

| Commit type | Example | Version bump |
|---|---|---|
| `fix:` | `fix: handle empty plugin list` | Patch (1.1.24 → 1.1.25) |
| `perf:` | `perf: cache registry lookups` | Patch |
| `refactor:` | `refactor: simplify adapter interface` | Patch |
| `feat:` | `feat: add Gemini adapter` | Minor (1.1.24 → 1.2.0) |
| `feat!:` | `feat!: drop Node 18 support` | **Major** (1.1.24 → 2.0.0) |
| `BREAKING CHANGE:` footer | (any type with this footer) | **Major** |
| `chore:`, `docs:`, `ci:`, `test:` | `docs: update README` | **No release** |

## Triggering a Major Version

Two ways to trigger a major (breaking) release:

```text
feat!: redesign plugin installation API

BREAKING CHANGE: The `install()` method now requires an options object
instead of positional arguments.
```

Or use the `BREAKING CHANGE:` footer on any commit type:

```text
refactor: rewrite CLI argument parsing

BREAKING CHANGE: The --run flag has been removed. Use installed assets directly.
```

## Manual / Local Release (Escape Hatch)

For cases where you need to release outside CI (e.g., hotfix from a local machine):

```bash
export NPM_TOKEN=your_npm_token_here
make release v1.2.3
```

This uses `scripts/release-local.mjs` which handles npm publish, git tagging, and GitHub Release creation. See `make release --help` for options.

## Verify a Release

```bash
npx forge-ai-assist@latest
npm_config_prefer_online=true npx forge-ai-assist@latest
```

Expected: assistant assets are installed under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.

## Secrets Required

| Secret | Where | Purpose |
|---|---|---|
| `NPM_TOKEN` | GitHub repo → Settings → Secrets → Actions | npm publish authentication |
| `GITHUB_TOKEN` | Automatic | Git push, GitHub Release creation |
