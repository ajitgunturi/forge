# Phase 10: Copilot Runtime Bootstrap And Install UX - Research

**Researched:** 2026-03-03
**Domain:** first-run installer UX, self-sufficient global runtime bootstrap, Copilot asset placement, installer metadata
**Confidence:** MEDIUM-HIGH

## User Constraints

Using phase context from: `.planning/phases/10-copilot-runtime-bootstrap-and-install-ux/10-CONTEXT.md`

Locked constraints from the request:

- Copilot remains the primary v1 target
- The target machine may not already have a working `.copilot` runtime
- The installer should take design inspiration from `npx get-shit-done-cc@latest`
- Installation should be global-only under `~/.copilot`
- Installed agents should call into bundled Forge tools under `~/.copilot`
- The problem to solve is missing runtime/bootstrap, not broader assistant scope

## Summary

The current Forge installer is too thin for a fresh-machine setup. It assumes a writable target path can be derived and that creating a single parent directory is enough. That is adequate for file copying, but not for a production-grade first-run installer because it leaves too much implicit:

1. Where Forge is being installed
2. What runtime structure Forge owns
3. Whether the installed agents can still function without a separate Forge binary on PATH
4. How future installs can tell what is already present

The GSD installer is a useful reference because it does three things well:

- it makes the install destination explicit
- it bootstraps missing runtime structure instead of assuming it exists
- it installs enough bundled runtime content to be self-sufficient
- it reports created artifacts in a maintainable way

Forge should borrow those qualities, but narrowly for Copilot. The likely architecture is:

1. Always resolve the install root to `~/.copilot`
2. Create the runtime directory tree and a Forge-owned tools payload under that root if they do not exist
3. Write a small Forge-owned metadata file if needed
4. Install or update the agent files so they call the bundled tools under `~/.copilot`
5. Report created structure, installed tools, and replaced assets separately

## Recommended Architecture

### Pattern 1: Explicit global install destination

- Always install under `~/.copilot`
- Tell the user that Forge is installing globally for Copilot
- Keep the exposed CLI Copilot-only for now

### Pattern 2: Runtime bootstrap before asset install

- Treat runtime bootstrap as its own step before writing agent files
- Create the required directory tree under `~/.copilot`
- Keep bootstrap idempotent so reruns are safe
- Bundle the runtime scripts or tools the agents need so they do not depend on `forge` being on PATH

### Pattern 3: Installer-owned metadata

- Write a small metadata artifact such as `forge-manifest.json` or `VERSION` in the runtime root
- Record installed summonables, Forge version, bundled tools, and last install timestamp
- Use that metadata to improve reporting and future update logic

### Pattern 4: First-run oriented output

- Show the global install path before writing files
- Report created directories separately from installed tools and installed or updated agent assets
- Give the user a precise next step after install, focused on Copilot `/agent`

## Pitfalls To Avoid

- Do not keep assuming `.copilot/agents` already exists
- Do not reintroduce project-local installation if the product decision is global-only
- Do not add multi-assistant complexity back into the public installer while trying to solve the fresh-machine Copilot problem
- Do not write opaque bootstrap state that Forge cannot later interpret
- Do not make installed agents depend on a separate Forge runtime that may not exist on the target machine

## Validation Architecture

- Verify install into a temp home directory with no preexisting `.copilot`
- Verify the bundled tools/runtime are present under `~/.copilot` after install
- Verify reruns distinguish created directories, bundled runtime updates, and unchanged or updated assets
- Verify installed assets still appear under the Copilot `/agent` discovery path
- Verify generated agents invoke bundled Forge tools from `~/.copilot`

## Plan Shape Recommendation

Use three plans:

1. Design the global Copilot install UX and runtime layout
2. Implement runtime bootstrap, bundled tools, and installer metadata
3. Add fresh-machine verification and documentation for the support model

## Source Notes

- GSD installer inspiration: explicit runtime destination, bootstrap of missing runtime assets, bundled runtime payload, clear created-vs-installed reporting
- Current observed target-system state: `~/.copilot` may exist only as an IDE-managed lock directory and not yet contain `agents/`
