# Phase 9: Release Management And Public Install - Context

**Gathered:** 2026-03-03
**Status:** Ready for planning
**Source:** User request

<domain>
## Phase Boundary

This phase adds a real release workflow for Forge so maintainers can cut releases from a local machine in a controlled way and users can install Forge with one command on any machine.

The phase must:

- add release management rather than relying on local-only `npm run build` and ad hoc packaging
- use a local-machine release flow for now rather than hosted CI publishing
- end with a single command that installs or runs Forge on any system with standard Node tooling available
- keep the current package identity and binary expectations aligned with prior phases unless a release constraint forces a change
- make release prerequisites, publish steps, versioning expectations, and rollback or verification steps explicit

This phase is about release and distribution infrastructure, not about changing Forge's runtime behavior or expanding assistant features.
</domain>

<decisions>
## Implementation Decisions

### Locked Decisions

- Forge needs release management, not just local packaging.
- The release workflow should run from the maintainer's local machine for now.
- The final product experience must support a single command to install or run Forge on any system.
- The solution should target Node distribution, not container-only distribution.

### Claude's Discretion

- Whether GitHub Releases are updated manually after local publication or left as a follow-on concern
- Whether releases are tag-driven, script-driven, or version-command-driven, as long as maintainers have a clear and auditable local release path
- The exact split between package metadata hardening, CI validation, release publishing, and documentation
- Whether the one-command install contract should emphasize `npx forge-ai-assist@latest`, global installation, or both
</decisions>

<specifics>
## Specific Ideas

- A local release command should likely run build, test, package validation, and publish steps in one sequence.
- GitHub Releases may still hold changelog text and packed tarballs, but that should not be required for the first local release workflow.
- npm appears to be the strongest candidate for frictionless public installation, while GitHub-hosted registries may be better suited to authenticated or mirrored distribution.
- The release workflow should likely verify that the published package still exposes the `forge` binary while keeping the package name `forge-ai-assist`.
</specifics>

<deferred>
## Deferred Ideas

- Multi-channel release trains such as beta, rc, and nightly
- OS-native installers such as Homebrew, Scoop, or winget
- Automatic post-install assistant configuration beyond the existing Forge installer behavior
</deferred>

---

*Phase: 09-release-management-and-public-install*
*Context gathered: 2026-03-03 from direct user requirements*
