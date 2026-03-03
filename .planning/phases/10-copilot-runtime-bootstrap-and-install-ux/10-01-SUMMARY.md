# 10-01 Summary

Made the global Copilot install destination explicit in the public Forge installer.

## What changed

- Updated the public CLI description to describe the global `~/.copilot` install model
- Updated install messaging to show the resolved global install root instead of implying repo-local writes
- Added install result details so the CLI can report created runtime paths and bundled runtime artifacts
- Updated smoke coverage to assert that Forge now installs under the user's home-directory Copilot root rather than the repository

## Verification

- [x] `npm run build`
- [x] `npm test -- tests/smoke/cli.test.ts`

## Notes

- The public installer is now explicitly global and Copilot-only
- Repo-local `.copilot` installation is no longer the expected user-facing model
