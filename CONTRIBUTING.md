# Contributing

## Local Development

Install dependencies, build, and run tests:

```bash
npm install
npm run build
npm test
```

## Project Structure

```text
src/
  cli.ts                          # CLI entry point
  program.ts                      # Commander.js installer surface
  contracts/
    assistants.ts                 # AssistantId, AssistantInstallLayout, AssistantOperationResult
    forge-plugin.ts               # ForgePlugin model
  commands/
    install-assistants.ts         # Interactive installer command
  services/
    assistants/
      registry.ts                 # AssistantAdapter interface and registry
      summonables.ts              # Plugin definitions
      exposure.ts                 # Naming and namespace routing
      runtime-rendering.ts        # Render functions for all assistants
      render-entry.ts             # Shared markdown renderer
      install.ts                  # AssistantInstallService
      copilot.ts                  # GitHub Copilot adapter
      claude.ts                   # Claude adapter
      codex.ts                    # Codex adapter
      gemini.ts                   # Gemini adapter
  lib/
    errors.ts                     # UserFacingError hierarchy
tests/
  unit/                           # Renderer, installer, and helper tests
  smoke/                          # End-to-end installer and packaging tests
docs/
  adding-skill-agent-template.md  # Required checklist for new assistant/plugin work
  plugin-architecture.md          # Architecture reference
  releasing.md                    # Release checklist
```

## Adding a New Plugin

See [docs/adding-skill-agent-template.md](docs/adding-skill-agent-template.md) for the required checklist and [docs/plugin-architecture.md](docs/plugin-architecture.md) for the architecture reference.

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

- Forge installs assistant assets globally under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.
- Claude, Codex, and Gemini keep static workflow reference files under `~/.{assistant}/forge/workflows`.
- Installed assets instruct the host assistant to run read-only `gh` commands directly in the current repository.
- Reinstalls clean legacy bundled runtime artifacts from older Forge releases.
