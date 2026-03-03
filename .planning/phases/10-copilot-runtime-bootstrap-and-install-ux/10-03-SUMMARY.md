# 10-03 Summary

Documented and verified the fresh-machine global Copilot install model.

## What changed

- Updated `README.md` to explain the global `~/.copilot` install path, bundled runtime contents, verification commands, and runtime-based discussion commands
- Updated `docs/releasing.md` to include post-publish validation of the bundled Copilot runtime
- Added Phase 10 UAT at `.planning/phases/10-copilot-runtime-bootstrap-and-install-ux/10-UAT.md`
- Expanded smoke verification to check the bundled runtime files and installer metadata under the home-directory Copilot root

## Verification

- [x] `npm run build`
- [x] `npm test`
- [x] `npm run release:check`

## Notes

- The clean-target-machine support story is now centered on `~/.copilot`
- Installed Copilot agents are expected to call the bundled runtime under `~/.copilot/forge`
