# 09-02 Summary

Added a local-machine release workflow so Forge can be validated and published without GitHub Actions.

## What changed

- Added `scripts/release-local.mjs` to run clean-worktree checks, verify local npm authentication, execute build and test, pack the exact tarball, and optionally publish it to npm
- Added `npm run release:local` as the maintainer entrypoint for dry runs and real publishes
- Documented publish prerequisites, local npm auth requirements, publish flags, and post-publish follow-up in `docs/releasing.md`

## Verification

- [x] `npm run build`
- [x] `npm run release:local -- --help`
- [x] `npm whoami` failure path confirms auth is required before publish

## Notes

- Real publish was not executed in this environment because npm auth is not configured here
- The release workflow publishes the packed tarball that was locally verified
