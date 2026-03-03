# Phase 9 UAT: Release Management And Public Install

## Test 1: Public install contract

1. Run `npm pack`
2. In a temporary directory, run `npm init -y`
3. Install the packed tarball with `npm install /absolute/path/to/forge-ai-assist-<version>.tgz`
4. Run `npx forge --help`

Expected:

- the command succeeds
- help output starts with `Usage: forge`
- default behavior remains Copilot-focused

## Test 2: Local release dry run

1. Ensure `npm login` is active on the machine
2. Run `npm run release:local`

Expected:

- the command checks git status, npm auth, build, test, and packing
- no publish happens
- the script prints the follow-up publish command

## Test 3: Publish path

1. Bump the version intentionally
2. Run `npm run release:local -- --publish`
3. Verify the new package version from a clean temp directory

Expected:

- npm publish succeeds
- `npx forge-ai-assist@latest --version` reports the new version after the registry updates
- the published package still exposes the `forge` binary
