# Phase 9: Release Management And Public Install - Research

**Researched:** 2026-03-03
**Domain:** Node package publishing, local release orchestration, public installation ergonomics
**Confidence:** HIGH

## User Constraints

Using phase context from: `.planning/phases/09-release-management-and-public-install/09-CONTEXT.md`

Locked constraints from the request:

- Forge needs a maintainer-facing release workflow
- The release workflow should run from a local machine for now
- The end result must be a single-command install or run experience on any system

## Summary

GitHub does offer the closest npm analogue to GHCR through GitHub Packages for npm, but it is not the right primary distribution target for Forge if the product promise is "one command on any system." GitHub Packages for npm is scoped, tied to GitHub authentication patterns, and introduces install friction that public npm does not. With the new cost constraint, the pragmatic architecture is:

1. Use a local release script or command sequence on the maintainer's machine
2. Publish the installable package to the public npm registry
3. Optionally attach packed tarballs or checksums to GitHub Releases manually for traceability and fallback installs

That preserves the universal install command `npx forge-ai-assist@latest` without requiring hosted CI minutes.

## Recommended Architecture

### Pattern 1: Public npm for installation, local machine for release

- Keep the public package name `forge-ai-assist`
- Preserve `forge` as the exposed executable
- Publish through npm so users can run `npx forge-ai-assist@latest` without extra auth or registry configuration
- Use npm as the authoritative install source and optionally publish matching Git tags or GitHub release notes after the package is live

### Pattern 2: Scripted local release checks

- Prefer a local scripted flow that runs build, test, and package validation first
- Keep the publish step explicit so maintainers can dry-run before pushing a release live
- Make version bumping, tagging, packing, and publishing auditable through documented commands

### Pattern 3: Package metadata hardening

- Add or verify `repository`, `homepage`, `bugs`, `license`, and publish-facing metadata in `package.json`
- Consider `publishConfig` and files/packlist correctness so the published artifact is minimal and reproducible
- Ensure the packed tarball includes only the runtime assets required for installation

### Pattern 4: Real install verification

- Validate `npm pack` output before publish
- Smoke-test the packed artifact in a temporary install location
- Keep at least one automated assertion around the universal install contract and surfaced binary name

## Pitfalls To Avoid

- Do not use GitHub Packages as the only install channel if frictionless public install is a hard requirement
- Do not publish directly from a developer machine without scripted validation and auditability
- Do not leave package metadata incomplete; discovery and provenance matter once the package is public
- Do not treat `npm pack` success as enough; installation from the packed artifact still needs to be proven
- Do not make the release workflow depend on local mutable state that GitHub Actions cannot reproduce

## Validation Architecture

- Verify package metadata is sufficient for public publishing and source discovery
- Verify the local release workflow runs build, test, and packaging steps before publish
- Verify a versioned release artifact can be installed or executed through the intended one-command path
- Verify release documentation explains the maintainer path and the user install path clearly

## Plan Shape Recommendation

Use three plans:

1. Harden package metadata and the install contract for publication
2. Add local release tooling and publish orchestration
3. Add release documentation and end-to-end verification for install/update flows

## Source Notes

- GitHub Packages for npm exists, but it is best treated as a secondary option here because public npm remains the most frictionless install path
- Local publishing means npm provenance or trusted-publisher-only assumptions should not be baked into the first release workflow
