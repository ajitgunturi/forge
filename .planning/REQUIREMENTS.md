# Requirements: Forge AI Assist

**Defined:** 2026-03-02
**Core Value:** A maintainer can run one Forge install flow, summon the right assistant entrypoint from their AI tool, and get usable repository analysis and action plans without Forge directly mutating the repository's working files.

## v1 Requirements

### Installation And Invocation

- [ ] **INVK-01**: User can run Forge through `npx forge-ai-assist@latest`
- [ ] **INVK-02**: Forge can install or update summonable assistant entries in assistant-owned runtime locations from one managed source
- [ ] **INVK-03**: Forge can make a GitHub Copilot agent available through `/agent` as the first end-to-end supported workflow
- [ ] **INVK-04**: Forge exits with a clear message when a repository-analysis flow is invoked outside a Git repository

### Sidecar Workspace

- [ ] **SIDE-01**: Forge writes all managed artifacts into a single Forge-owned directory that can be ignored by the host repository
- [ ] **SIDE-02**: Forge does not modify user repository source files during v1 flows
- [ ] **SIDE-03**: Forge can rerun in the same repository without duplicating or corrupting its managed sidecar artifacts
- [ ] **SIDE-04**: Forge records enough metadata in the sidecar directory to understand prior runs and generated outputs

### Repository Analysis

- [ ] **ANLY-01**: Forge can detect the current Git repository root and analyze repository context from that root
- [ ] **ANLY-02**: Forge can inventory key repository characteristics needed for planning, including stack, structure, and existing assistant-relevant context
- [ ] **ANLY-03**: Forge can distinguish between repository facts it observed and recommendations it inferred
- [ ] **ANLY-04**: Forge can surface analysis results in sidecar artifacts that users or maintainers can review later

### Planning Outputs

- [ ] **PLAN-01**: Forge can generate action plans for users or maintainers based on repository analysis
- [ ] **PLAN-02**: Action plans are specific, reviewable, and do not assume Forge will apply code changes automatically
- [ ] **PLAN-03**: Action plans can be associated with a requested task, assistant context, or workflow entrypoint
- [ ] **PLAN-04**: Forge can preserve prior plan outputs in the sidecar directory for later follow-up

### Assistant Support

- [ ] **ASST-01**: Forge supports major assistant contexts including Claude, GitHub Copilot, Codex, and Gemini
- [ ] **ASST-02**: Forge can present or expose the right summonable skill, agent, or task entrypoint for each supported assistant context
- [ ] **ASST-03**: Forge can keep a shared internal task model while adapting presentation to assistant-specific conventions
- [ ] **ASST-04**: Forge can no-op safely when a requested assistant context is unsupported or unavailable
- [ ] **ASST-05**: Forge can manage assistant installation targets without requiring users to manually copy files into multiple assistant directories

### Delivery Foundations

- [ ] **DELV-01**: Project ships as an npm package that exposes a CLI executable for `npx forge-ai-assist@latest`
- [ ] **DELV-02**: Project includes automated tests for Git-repo detection, sidecar writes, and rerun idempotency
- [ ] **DELV-03**: Project includes automated tests for analysis output generation and plan generation
- [ ] **DELV-04**: Project includes smoke tests that validate sidecar-only behavior against temporary Git repositories

## v2 Requirements

### Extended Operations

- **EXTD-01**: Forge can offer optional repository modification workflows after users approve generated plans
- **EXTD-02**: Forge can support upgrade and migration flows for previously generated sidecar artifacts
- **EXTD-03**: Forge can expand assistant-specific capability packs beyond baseline summonability

## Out of Scope

| Feature | Reason |
|---------|--------|
| Writing assistant-native config files directly into the target repository | v1 must remain a sidecar and avoid interfering with user repository files |
| Automatic code changes to the repository | First delivery is analysis and planning only |
| Full planning/execution workflow engine | Broader automation is deferred until sidecar analysis value is proven |
| Hosted registry or cloud sync | Not needed for the initial sidecar product value |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| INVK-01 | Phase 1 | Pending |
| INVK-02 | Phase 4 | Pending |
| INVK-03 | Phase 3 | Pending |
| INVK-04 | Phase 1 | Pending |
| SIDE-01 | Phase 1 | Pending |
| SIDE-02 | Phase 1 | Pending |
| SIDE-03 | Phase 1 | Pending |
| SIDE-04 | Phase 1 | Pending |
| ANLY-01 | Phase 2 | Pending |
| ANLY-02 | Phase 2 | Pending |
| ANLY-03 | Phase 2 | Pending |
| ANLY-04 | Phase 2 | Pending |
| PLAN-01 | Phase 3 | Pending |
| PLAN-02 | Phase 3 | Pending |
| PLAN-03 | Phase 3 | Pending |
| PLAN-04 | Phase 3 | Pending |
| ASST-01 | Phase 4 | Pending |
| ASST-02 | Phase 4 | Pending |
| ASST-03 | Phase 4 | Pending |
| ASST-04 | Phase 4 | Pending |
| ASST-05 | Phase 4 | Pending |
| DELV-01 | Phase 1 | Pending |
| DELV-02 | Phase 5 | Pending |
| DELV-03 | Phase 5 | Pending |
| DELV-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-02*
*Last updated: 2026-03-02 after roadmap traceability alignment*
