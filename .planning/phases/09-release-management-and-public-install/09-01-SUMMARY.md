# 09-01 Summary

Hardened Forge's package contract for public publication and proved the packed install path.

## What changed

- Added publish-facing metadata in `package.json`, including repository, homepage, bugs, keywords, license, and public publish configuration
- Added `prepack` and `release:check` scripts so release validation always rebuilds and verifies package contents
- Extended smoke coverage to pack the tarball, install it into a temporary npm project, and invoke the published `forge` binary from that installed artifact
- Synced `package-lock.json` with the updated manifest metadata

## Verification

- [x] `npm run build`
- [x] `npm test`
- [x] `npm run release:check`

## Notes

- The public install contract remains `npx forge-ai-assist@latest`
- The installed binary remains `forge`
