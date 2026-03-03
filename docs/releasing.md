# Releasing Forge

Forge releases currently run from the maintainer's local machine. There is no GitHub Actions publishing flow in Phase 9.

## Prerequisites

- Node 22 or newer
- npm authentication configured locally via `npm login`
- A clean git worktree, unless you intentionally override the check
- Release-ready package version already set in `package.json`

## Recommended Release Sequence

1. Update the package version:

```bash
npm version patch
```

2. Run the local release validation flow:

```bash
npm run release:local
```

This command checks:

- git worktree cleanliness
- local npm authentication
- `npm run build`
- `npm test`
- `npm pack --json`

3. Publish the verified tarball:

```bash
npm run release:local -- --publish
```

Optional flags:

- `--tag next` to publish under a non-`latest` dist-tag
- `--otp 123456` if your npm account requires one-time passwords
- `--allow-dirty` only if you intentionally want to bypass the clean-worktree check
- `--keep-tarball` to retain the packed `.tgz` artifact after the command exits

## After Publish

Recommended follow-up steps:

1. Push the version commit and git tag
2. Create or update a GitHub Release note for the published version
3. Verify public install:

```bash
npx forge-ai-assist@latest --version
```

## Failure Handling

- If `npm whoami` fails, run `npm login` and retry
- If tests fail, do not publish; fix the issue and rerun the release command
- If publish succeeds but local cleanup fails, the release is already live; remove the tarball manually and proceed with tag/release-note cleanup
