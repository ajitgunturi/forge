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

## Commit Messages & Versioning

Forge uses [Conventional Commits](https://www.conventionalcommits.org/) to **automatically determine releases**. Your commit message type controls what happens when your PR merges to `main`:

| Type | Effect | Example |
|---|---|---|
| `fix:` | Patch release | `fix: handle empty plugin list` |
| `feat:` | Minor release | `feat: add Gemini adapter` |
| `feat!:` or `BREAKING CHANGE:` footer | **Major release** | `feat!: drop Node 18 support` |
| `chore:`, `docs:`, `ci:`, `test:` | No release | `docs: update README` |

**You never set a version number.** The CI pipeline reads your commits and publishes automatically.

For a major (breaking) release, either use `!` after the type or add a `BREAKING CHANGE:` footer:

```text
feat!: redesign plugin installation API

BREAKING CHANGE: The install() method now requires an options object.
```

See [docs/releasing.md](docs/releasing.md) for full details including the manual escape hatch.

## Branch Protection

All changes to `main` must go through a pull request with passing CI. Direct pushes are blocked for all contributors.

## Runtime Notes

- Forge installs assistant assets globally under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.
- Claude, Codex, and Gemini keep static workflow reference files under `~/.{assistant}/forge/workflows`.
- Installed assets instruct the host assistant to run read-only `gh` commands directly in the current repository.
- Reinstalls clean legacy bundled runtime artifacts from older Forge releases.
