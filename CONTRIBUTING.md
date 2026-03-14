# Contributing

## Local Development

Install dependencies, build, and run tests:

```bash
npm install
npm run build
npm test
```

## Project Structure

```
src/
  cli.ts                          # CLI entry point
  program.ts                      # Commander.js program and analyzer dispatch
  contracts/
    assistants.ts                 # AssistantId, AssistantInstallLayout, AssistantOperationResult
    forge-plugin.ts               # ForgePlugin — assistant-agnostic plugin model
    discussions.ts                # Discussion data models, GitHubRepositoryRef
    issues.ts                     # Issue data models
    pr-reviews.ts                 # PR review comment data models
  lib/
    errors.ts                     # UserFacingError hierarchy
  config/
    sidecar.ts                    # .forge directory constants
    analysis.ts                   # Analysis config constants
  commands/
    install-assistants.ts         # Interactive installer command
  services/
    git.ts                        # Git operations and GitHub remote parsing
    sidecar.ts                    # .forge sidecar initialization
    metadata.ts                   # Sidecar metadata persistence
    discussions/                  # Discussion analyzer pipeline
      auth.ts                    # GitHub token resolution (shared)
      fetch.ts                   # GraphQL fetching
      filters.ts                 # Filter normalization
      run.ts                     # Fetch runner
      request-intent.ts          # Intent analysis
      prepare.ts                 # Digest preparation and classification
      analyze.ts                 # Orchestrator, rendering, persistence
    issues/                      # Issue analyzer pipeline
      fetch.ts                   # REST API fetching
      filters.ts                 # Filter normalization
      run.ts                     # Fetch runner
      request-intent.ts          # Intent analysis
      prepare.ts                 # Digest preparation and classification
      analyze.ts                 # Orchestrator, rendering, persistence
    pr-reviews/                  # PR review analyzer pipeline
      fetch.ts                   # REST API fetching (PR + review comments)
      filters.ts                 # Filter normalization
      resolve-pr.ts              # Auto-detect PR from current branch
      run.ts                     # Fetch runner
      request-intent.ts          # Intent analysis
      prepare.ts                 # Comment classification and fix extraction
      analyze.ts                 # Orchestrator, rendering, persistence
    assistants/
      registry.ts                # AssistantAdapter interface, AssistantRegistry
      summonables.ts             # Plugin definitions (discussion, issue, pr-review)
      exposure.ts                # Naming and namespace routing
      runtime-rendering.ts       # Render functions for all assistants
      render-entry.ts            # EntryRenderer utility
      install.ts                 # AssistantInstallService
      copilot.ts                 # GitHub Copilot adapter
      claude.ts                  # Claude adapter
      codex.ts                   # Codex adapter
      gemini.ts                  # Gemini adapter
```

## Adding a New Plugin

See [docs/adding-skill-agent-template.md](docs/adding-skill-agent-template.md) for the step-by-step checklist and [docs/plugin-architecture.md](docs/plugin-architecture.md) for the full architecture reference.

## Release

Dry-run (version bump + build + test, no publish):

```bash
make release-check v1.2.0
```

Full release (npm publish + GitHub Release):

```bash
make release v1.2.0
```

Push just the tag and GitHub Release (if version was already bumped):

```bash
make release-tag v1.2.0
```

## Runtime Notes

- Forge installs bundled runtimes globally under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.
- Each assistant discovers its Forge plugins from its native surface (agents, commands, or skills).
- Repository-scoped artifacts and analysis traces are written under `.forge`.
