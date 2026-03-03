# 09-03 Summary

Documented the release and install path so both end users and maintainers can operate Forge without reverse-engineering the repo.

## What changed

- Added a top-level `README.md` with install, update, local development, and discussions-token guidance
- Added a phase UAT script at `.planning/phases/09-release-management-and-public-install/09-UAT.md`
- Kept the release runbook aligned with the new local `release:local` workflow

## Verification

- [x] `npm run build`
- [x] `npm test`

## Notes

- User-facing install guidance now points to `npx forge-ai-assist@latest`
- Maintainer-facing release guidance now points to `npm run release:local`
