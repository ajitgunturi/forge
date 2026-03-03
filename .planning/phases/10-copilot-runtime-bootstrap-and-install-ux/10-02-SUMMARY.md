# 10-02 Summary

Bootstrapped a self-contained Forge runtime under `~/.copilot` so installed Copilot agents no longer depend on a separate Forge binary on PATH.

## What changed

- Added Copilot install-layout resolution for `~/.copilot`, `~/.copilot/agents`, and the bundled runtime subtree under `~/.copilot/forge`
- Refactored the installer to create missing runtime directories before writing agent assets
- Bundled the Forge runtime by copying `dist/` into `~/.copilot/forge/dist`, writing `~/.copilot/forge/package.json`, `~/.copilot/forge/bin/forge.mjs`, and `~/.copilot/forge/VERSION`
- Added installer-owned metadata at `~/.copilot/forge/forge-file-manifest.json`
- Updated generated Copilot agent instructions so they invoke `node "$HOME/.copilot/forge/bin/forge.mjs"` instead of relying on a separate `forge` command

## Verification

- [x] `npm run build`
- [x] `npm test -- tests/smoke/cli.test.ts`

## Notes

- The bundled runtime is overwritten on install so reruns can repair or update Forge-owned files
- The manifest records install root, runtime paths, summonables, and bundled files for later inspection
