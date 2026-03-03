# Phase 10: Copilot Runtime Bootstrap And Install UX - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** User request plus observed target-system install failure mode

<domain>
## Phase Boundary

This phase is about first-run installation behavior on a target machine that does not already have a usable Copilot runtime directory structure.

The phase must:

- keep GitHub Copilot as the primary v1 assistant target
- make `npx forge-ai-assist@latest` work on a machine where `~/.copilot` may not contain an `agents/` directory at all
- always install globally into `~/.copilot`, not into the repository or project
- bootstrap the missing runtime layout and bundled tool payload under `~/.copilot` instead of assuming it already exists
- improve the installer UX so users can understand that Forge is being installed globally and what runtime artifacts are being written
- take design inspiration from the GSD installer flow without copying its full multi-runtime scope

This phase is not about expanding the public assistant matrix again. It is about making the Copilot-first installer production-credible on fresh systems.
</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- v1 remains primarily targeted at `.copilot`.
- The installer must handle target machines where the runtime layout is missing.
- Installation should be global only, under `~/.copilot`.
- The installed Copilot agents should invoke Forge-owned tools from the installed runtime under `~/.copilot`.
- The design can take inspiration from the `get-shit-done-cc` installer flow.
- The implementation should solve the first-run install problem directly instead of assuming users will manually create runtime folders.

### Claude's Discretion

- The exact internal layout under `~/.copilot` for bundled Forge tools, manifests, and agent entrypoints
- Whether Forge should write installer-owned metadata such as version files or manifests under the Copilot runtime root
- The exact shape of first-run status reporting, as long as it is explicit about created directories and installed assets
- Whether the installer should detect unsupported or unknown Copilot runtime states and repair them, or just replace the Forge-owned subset of files
</decisions>

<specifics>
## Specific Ideas

- Install into `~/.copilot` by default and do not expose project-local installation in v1
- Bootstrap `~/.copilot/agents/` plus a Forge-owned tools/runtime subtree as needed
- Write a small Forge-owned version or manifest artifact so future installs can detect and report updates cleanly
- Improve install output so the user sees the target path and the exact files or directories created or replaced
</specifics>

<deferred>
## Deferred Ideas

- Re-exposing multi-runtime installation in the public CLI
- Project-local Forge installs
- Assistant-specific hook systems or richer runtime payloads
- Migration or repair logic for assistants other than Copilot
</deferred>

---

*Phase: 10-copilot-runtime-bootstrap-and-install-ux*
*Context gathered: 2026-03-03 from target-system install observations and direct user direction*
