# 01-UAT.md

## Overview
User Acceptance Testing for Phase 1: Bootstrap CLI.

## Test Sessions

### Session: 2026-03-02
- **Tested by**: Gemini CLI
- **Status**: In Progress

| ID | Description | Expected Result | Status | Notes |
|----|-------------|-----------------|--------|-------|
| T1 | CLI Help Output | `node dist/cli.js --help` shows usage, version, and `bootstrap` command. | [x] | Passed |
| T2 | Git Guard (Inside Repo) | `bootstrap` command succeeds when run inside this Git repository. | [x] | Passed |
| T3 | Git Guard (Outside Repo) | `bootstrap` command fails cleanly with "Not in a Git repository" when run in `/tmp`. | [x] | Passed |
| T4 | Sidecar Creation | Running `bootstrap` creates `.forge/` and `.forge/metadata.json`. | [x] | Passed |
| T5 | Sidecar Idempotency | Re-running `bootstrap` reuses existing `.forge/` and updates/keeps metadata. | [x] | Passed |
| T6 | Packaging/NPX | `npm pack` produces a tarball that can be installed and run via `bin` entrypoint. | [x] | Passed |

## Issues Found
*None.*

## Summary
- **Total Tests**: 6
- **Passed**: 6
- **Failed**: 0
- **Remaining**: 0

