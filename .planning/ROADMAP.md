# Roadmap: Forge AI Assist

**Created:** 2026-03-02
**Scope:** v1
**Planning basis:** `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`, `.planning/research/SUMMARY.md`, `.planning/config.json`

## Roadmap Principles

- Keep repo-specific outputs inside one ignorable Forge sidecar directory
- Treat v1 as analysis and action-planning only, not automatic repository modification
- Prove the product end to end first through GitHub Copilot discussion analysis
- Expand assistant coverage only after the first summoned workflow is real and reviewable
- Preserve exact one-phase coverage for every v1 requirement

## Phase 1: Bootstrap CLI (Complete)

Establish the packaged entrypoint, repository guardrails, and sidecar lifecycle needed for every later flow.

**Goal:** Establish the packaged entrypoint, repository guardrails, and sidecar lifecycle needed for every later flow.
**Requirements:** INVK-01, INVK-04, SIDE-01, SIDE-02, SIDE-03, SIDE-04, DELV-01

**Success criteria:**

- Running `npx forge-ai-assist@latest` starts the Forge CLI through the published npm package entrypoint
- Invoking a repository-analysis flow outside a Git repository exits cleanly with an explicit user-facing message
- Forge creates and reuses exactly one repo-local sidecar directory for all managed artifacts
- Re-running Forge in the same repository updates or reuses sidecar contents without duplicate artifact trees or corrupted metadata
- No v1 bootstrap flow writes to repository source files outside the Forge sidecar directory

## Phase 2: Repository Analysis (Complete)

Build the sidecar-first analysis engine that inspects a Git repository, records observed facts, and produces reviewable analysis artifacts.

**Goal:** Build the sidecar-first analysis engine that inspects a Git repository, records observed facts, and produces reviewable analysis artifacts.
**Requirements:** ANLY-01, ANLY-02, ANLY-03, ANLY-04

**Success criteria:**

- Forge detects the active Git repository root and scopes analysis to that root consistently
- Analysis artifacts capture repository stack, structure, and assistant-relevant context needed for planning
- Output clearly separates observed repository facts from inferred recommendations
- Analysis results are written to durable sidecar artifacts that remain available across reruns

## Phase 3: Copilot Planning Proof (Complete)

Deliver the first full summoned workflow by exposing a GitHub Copilot discussion entrypoint that turns repository analysis into reviewable action plans.

**Goal:** Deliver the first full summoned workflow by exposing a GitHub Copilot discussion entrypoint that turns repository analysis into reviewable action plans.
**Requirements:** INVK-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04

**Success criteria:**

- A GitHub Copilot `/agent` entrypoint can invoke the first end-to-end Forge workflow
- The workflow produces action plans grounded in repository analysis rather than generic templates
- Plans are explicit, reviewable, and do not assume Forge will apply code changes automatically
- Generated plans are associated with the invoked discussion, task, or workflow context in sidecar metadata
- Repeated planning runs preserve prior plan outputs for later comparison or follow-up

## Phase 4: Assistant Runtime Expansion (Complete)

Generalize install and summon flows from the Copilot proof into a shared model that supports the broader assistant set from one managed source.

**Goal:** Generalize install and summon flows from the Copilot proof into a shared model that supports the broader assistant set from one managed source.
**Requirements:** INVK-02, ASST-01, ASST-02, ASST-03, ASST-04, ASST-05

**Success criteria:**

- Forge installs or updates assistant-owned summonable entries from one managed source of truth
- Supported assistant contexts include Claude, GitHub Copilot, Codex, and Gemini
- Each supported assistant receives the appropriate summonable skill, agent, or task entrypoint for its native conventions
- Forge uses one shared internal task model while adapting presentation per assistant
- Unsupported or unavailable assistant contexts no-op safely without damaging prior installation state

## Phase 5: Quality Gates (Complete)

Lock in sidecar safety and planning reliability with automated test coverage and smoke validation against temporary Git repositories.

**Goal:** Lock in sidecar safety and planning reliability with automated test coverage and smoke validation against temporary Git repositories.
**Requirements:** DELV-02, DELV-03, DELV-04

**Success criteria:**

- Automated tests cover Git-repo detection, sidecar writes, and rerun idempotency
- Automated tests cover analysis artifact generation and action-plan generation
- Smoke tests validate sidecar-only behavior against temporary Git repositories

## Phase 6: Milestone Audit Closure (Complete)

Close the auditability gap left after bootstrap by producing milestone-grade verification artifacts and restoring traceable evidence for the implemented Phase 1 requirements.

**Goal:** Close the auditability gap left after bootstrap by producing milestone-grade verification artifacts and restoring traceable evidence for the implemented Phase 1 requirements.
**Requirements:** INVK-01, INVK-04, SIDE-01, SIDE-02, SIDE-03, SIDE-04, DELV-01
**Gap Closure:** Closes gaps from audit

**Success criteria:**

- Phase 1 has a verification artifact that explicitly covers its implemented requirements
- Phase 1 summaries or equivalent audit inputs record requirements-completed evidence compatible with milestone auditing
- The milestone audit can mark the implemented bootstrap requirements as satisfied instead of failing on missing verification metadata
- No product behavior changes are required outside the evidence and verification work needed to close the audit gap

## Traceability Coverage

| Phase | Requirement Count | Requirements | Status |
|-------|-------------------|--------------|--------|
| Phase 1 | 7 | INVK-01, INVK-04, SIDE-01, SIDE-02, SIDE-03, SIDE-04, DELV-01 | Complete |
| Phase 2 | 4 | ANLY-01, ANLY-02, ANLY-03, ANLY-04 | Complete |
| Phase 3 | 5 | INVK-03, PLAN-01, PLAN-02, PLAN-03, PLAN-04 | Complete |
| Phase 4 | 6 | INVK-02, ASST-01, ASST-02, ASST-03, ASST-04, ASST-05 | Complete |
| Phase 5 | 3 | DELV-02, DELV-03, DELV-04 | Complete |
| Phase 6 | 7 | INVK-01, INVK-04, SIDE-01, SIDE-02, SIDE-03, SIDE-04, DELV-01 | Complete |

**Coverage validation:**

- v1 requirements: 25
- Phase-mapped requirements: 25
- Unmapped requirements: 0
- Multi-mapped requirements: 0

**Gap-closure note:**

- Phase 6 exists to close milestone-audit evidence gaps for already-implemented Phase 1 requirements; the authoritative requirement-to-phase assignment lives in `.planning/REQUIREMENTS.md`

## Notes

- The roadmap deliberately prioritizes sidecar-safe analysis before broad assistant expansion because v1 value is repository understanding and planning, not repo mutation
- Research recommendations that imply writing generated outputs into the target repository are deferred or narrowed to assistant-owned runtime locations plus the ignorable Forge sidecar
- GitHub Copilot discussion analysis is the first end-to-end proof; broader multi-assistant parity follows after that proof works

## Phase 7: Installer Simplification And GitHub Discussions Ingest (Complete)

Recast Forge as a single-entry interactive installer invoked via `npx forge-ai-assist@latest`, while adding a sidecar-native GitHub Discussions ingestion capability for assistant-driven analysis.

**Goal:** Recast Forge as a single-entry interactive installer exposed as `forge`, remove the legacy direct CLI command surface, and add an assistant summonable capability that fetches GitHub Discussions into the `.forge` sidecar for later analysis.
**Requirements:** EXTD-03
**Depends on:** Phase 6
**Plans:** 3 plans

**Success criteria:**

- Running `npx forge-ai-assist@latest` launches Forge as the `forge` binary and immediately enters the interactive assistant-selection install flow
- The published CLI no longer exposes bootstrap/analyze/plan/install subcommands as the primary user experience
- Forge can install a summonable GitHub Discussions fetcher skill or agent for supported assistants from the existing shared runtime model
- The discussions fetch flow derives the current repository owner and name from `origin`, fetches discussion data through an authenticated GitHub API path, and stores durable artifacts only under `.forge`
- The discussions workflow checks for `GH_TOKEN` or `GITHUB_TOKEN` before fetching and tells the user to configure one in their shell when both are missing
- The discussions workflow supports user-provided fetch filters including relative windows (`today`, `yesterday`, `last week`), explicit `after`/`before` bounds, and discussion category constraints

Plans:
- [x] 07-01 - Rework packaging and CLI entry into the default interactive installer
- [x] 07-02 - Add GitHub Discussions fetch assets and sidecar persistence
- [x] 07-03 - Add token preflight and user-driven discussion filters

## Phase 8: Cross-Assistant Forge Discussion Analyzer Summonable (Complete)

Turn the attached `gh-discussion-analyzer.agent.md` behavior into a Forge-managed summonable named `forge-discussion-analyzer` that can be installed across supported assistant runtimes while offloading the heavy execution logic and context into Forge.

**Goal:** Deliver a named cross-assistant summonable, `forge-discussion-analyzer`, that users can invoke from assistant-native `/agent` or equivalent surfaces while Forge handles data fetching, sidecar preparation, runtime scripts, and context minimization behind the scenes.
**Requirements:** EXTD-03
**Depends on:** Phase 7
**Plans:** 3 plans

**Success criteria:**

- Forge installs a distinct summonable named `forge-discussion-analyzer` for supported assistant runtimes instead of only a generic Forge entry
- A user can invoke the installed summonable from assistant-native surfaces such as Copilot `/agent` selection and ask a follow-up question without pasting the full legacy `.agent.md` body
- Forge owns the discussions-fetch, caching, and preprocessing scripts so assistant-installed assets stay compact and focused on invocation semantics
- The analysis workflow uses `.forge/discussions` artifacts plus Forge-managed preprocessing outputs to minimize model context while preserving analysis quality
- Supported assistants receive the closest native equivalent of the same summonable capability, with explicit no-op or degradation behavior where a platform cannot mirror Copilot exactly

Plans:
- [x] 08-01 - Add named summonable asset support and install forge-discussion-analyzer across assistants
- [x] 08-02 - Build the Forge-managed discussion analysis runtime and compact context pipeline
- [x] 08-03 - Wire assistant-native invocation flows and verify cross-assistant summonability

## Phase 9: Release Management And Public Install (Complete)

Add a maintainer-grade local release workflow that turns Forge into a publishable product with versioned releases and one-command installation on any machine.

**Goal:** Establish release management for Forge from the maintainer's local machine while publishing the installable CLI through a public Node distribution path that keeps `npx forge-ai-assist@latest` as the universal install command.
**Requirements:** EXTD-03
**Depends on:** Phase 8
**Plans:** 3 plans

**Success criteria:**

- Forge has a documented, repeatable local release workflow that validates builds/tests and publishes versioned artifacts without manual file shuffling
- Maintainers can cut and verify a release entirely from a local machine without depending on GitHub Actions
- The public install path remains a single command that works on any system with Node and npm available
- Package metadata, repository metadata, and release artifacts are aligned so users can discover the project, install it, and verify the installed version cleanly
- Automated verification covers the packaged artifact, publish prerequisites, and at least one realistic install path from a built release artifact

Plans:
- [x] 09-01 - Harden package metadata and define the public install contract
- [x] 09-02 - Add local release tooling and publish orchestration
- [x] 09-03 - Document local release operations and verify the install/update path

## Phase 10: Copilot Runtime Bootstrap And Install UX (Complete)

Make Forge install cleanly on a fresh target machine by bootstrapping a self-sufficient runtime under `~/.copilot`.

**Goal:** Turn `npx forge-ai-assist@latest` into a robust first-run installer for GitHub Copilot that always installs globally into `~/.copilot`, bootstraps the required runtime payload there, and lets the installed agents invoke Forge-owned tools from that runtime instead of depending on a project-local Forge package.
**Requirements:** EXTD-03
**Depends on:** Phase 9
**Plans:** 3 plans

**Success criteria:**

- Forge installs successfully on a fresh machine where `~/.copilot` has no existing agent runtime structure
- The installer always targets `~/.copilot` and makes that destination explicit
- Forge bootstraps any required directories, tools, and installer-owned metadata under `~/.copilot` instead of assuming the runtime already exists
- The installed Copilot assets remain discoverable by `/agent` after a clean first-time install
- The installed agents can invoke Forge-owned tools from inside `~/.copilot` without relying on a globally linked `forge` binary or a project-local package
- The installer reports exactly what it created, updated, or replaced so first-run behavior is auditable and supportable

Plans:
- [x] 10-01 - Design the global Copilot installer UX and runtime payload model
- [x] 10-02 - Bootstrap the ~/.copilot runtime, tools, and installer metadata
- [x] 10-03 - Verify fresh-machine global installs and document the support model
