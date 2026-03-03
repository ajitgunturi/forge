# Phase 1 Verification Report: Core Bootstrap & Sidecar

## Summary Table

| Requirement | Description | Status | Evidence Source |
| ----------- | ----------- | ------ | --------------- |
| SIDE-01 | Single Forge-owned directory (.forge) | PASS | `src/config/sidecar.ts`, `tests/smoke/cli.test.ts` |
| SIDE-02 | No source modification | PASS | `src/services/sidecar.ts`, `tests/smoke/cli.test.ts` |
| SIDE-03 | Idempotency | PASS | `tests/smoke/cli.test.ts` ('multiple runs do not corrupt') |
| SIDE-04 | Metadata tracking | PASS | `src/services/metadata.ts`, `tests/smoke/cli.test.ts` |
| INVK-04 | Git repository guard | PASS | `src/services/git.ts`, `tests/smoke/cli.test.ts` |

---

## Detailed Mapping

### SIDE-01: Single Forge-owned directory (.forge)
Forge MUST operate within a single Forge-owned directory (.forge) in the repository root.

- **Source Evidence:** `src/config/sidecar.ts` defines `SIDECAR_DIR_NAME = '.forge'`. `src/services/sidecar.ts` uses this to derive all paths.
- **Test Evidence:** Smoke test `creates .forge/metadata.json in a git repo` verifies that the `.forge` directory is created and contains the metadata file.

### SIDE-02: No source modification
Forge MUST NOT modify the host repository's source files, directory structure, or Git history during normal operations.

- **Source Evidence:** `src/services/sidecar.ts` only performs writes within the `sidecarPath`. A code audit confirms no `fs` calls are made outside the sidecar directory.
- **Test Evidence:** Smoke tests use isolated temporary directories and only verify changes within the `.forge` directory.

### SIDE-03: Idempotency
Forge operations MUST be idempotent; re-running bootstrap or analysis MUST NOT corrupt existing sidecar state.

- **Source Evidence:** `src/services/sidecar.ts`'s `initializeSidecar` reads existing metadata if present instead of overwriting it blindly.
- **Test Evidence:** Smoke test `multiple runs do not corrupt metadata or sidecar` verifies that `createdAt` is preserved and history is appended correctly upon multiple runs.

### SIDE-04: Metadata tracking
Forge MUST track its own state and history within the .forge directory via a structured metadata file.

- **Source Evidence:** `src/services/metadata.ts` defines a Zod schema for `metadata.json` including versioning, creation/update timestamps, and a run history log.
- **Test Evidence:** Smoke test `multiple runs do not corrupt metadata or sidecar` checks `metadata.history.length` to confirm tracking is functional.

### INVK-04: Git repository guard
Forge MUST NOT run in a directory that is not part of a Git repository.

- **Source Evidence:** `src/services/git.ts`'s `getRepoRoot` throws a `RepositoryRequiredError` if `git rev-parse --show-toplevel` fails. This is called early in `bootstrapCommand`.
- **Test Evidence:** Smoke test `exits with error outside a git repo` confirms the CLI fails with a relevant error message when run outside a repository.

---

## Automated Test Evidence

```text
> forge-ai-assist@0.1.0 test:smoke
> vitest run tests/smoke


 RUN  v4.0.18 /Users/ajitg/workspace/forge

 ✓ tests/smoke/cli.test.ts (5 tests) 1904ms
   ✓ CLI Smoke Tests - Full Flow (5)
     ✓ bootstrap (2)
       ✓ creates .forge/metadata.json in a git repo 284ms
       ✓ exits with error outside a git repo 135ms
     ✓ analyze (1)
       ✓ generates analysis artifacts in .forge/analysis/  348ms
     ✓ plan (1)
       ✓ generates a plan in .forge/planning/ based on analysis  493ms
     ✓ idempotency (1)
       ✓ multiple runs do not corrupt metadata or sidecar  644ms

 Test Files  1 passed (1)
      Tests  5 passed (5)
   Start at  08:32:19
   Duration  2.11s (transform 21ms, setup 0ms, import 81ms, tests 1.90s, environment 0ms)
```
