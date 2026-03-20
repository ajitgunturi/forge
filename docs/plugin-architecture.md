# Forge Plugin Architecture Reference

This document describes how Forge plugins are defined, rendered, installed, and consumed by AI assistants.

## Core Design Principles

1. **Define once, render to many.** A plugin is defined as a single `ForgePlugin`. Claude, Copilot, Gemini, and Codex each render that definition into their own native format.
2. **Strictly read-only.** Installed assets must never create, update, close, comment on, or mutate any GitHub resource.
3. **Direct `gh` execution.** The installed assets tell the host assistant to use read-only `gh` commands directly. Forge no longer ships an assistant-side Node runtime.
4. **Live-fetch-only.** Every answer must come from a fresh GitHub fetch at execution time.
5. **Managed content with preserved customizations.** Installed files use Forge-managed markers so reinstalls replace only the managed block while leaving user customizations intact.
6. **Legacy runtime cleanup.** Reinstalls remove old `forge/bin`, `forge/dist`, `forge/node_modules`, `forge/VERSION`, `forge/package.json`, and `forge-file-manifest.json` artifacts from earlier releases.

## Architecture Overview

```text
ForgePlugin (assistant-agnostic definition)
       │
       ├── AssistantAdapter.render(entry) ──► Native format per assistant
       │      ├── Claude: Markdown command + agent + workflow
       │      ├── Copilot: Markdown agent + skill
       │      ├── Gemini: TOML command + agent + workflow
       │      └── Codex: Markdown skill + agent (md+toml) + workflow
       │
       └── AssistantInstallService
              ├── create needed directories
              ├── remove legacy bundled runtime artifacts
              ├── write primary + supplemental assets
              └── preserve user customizations on reinstall
```

At execution time, the host assistant runs read-only GitHub CLI commands directly in the current repository:

- Discussions: `gh api graphql`
- Issues: `gh issue list` and `gh issue view --json`
- PR reviews: `gh pr view` / `gh pr list --json`, plus read-only `gh api repos/{owner}/{repo}/pulls/<pr>/comments` when inline review comments are needed

## Plugin Definition

**File:** `src/contracts/forge-plugin.ts`

```ts
interface ForgePlugin {
  id: string;
  displayName: string;
  purpose: string;
  instructions: string;
  capabilities: ForgePluginCapability[];
  commands: ForgePluginCommand[];
  principles: string[];
  metadata?: Record<string, any>;
}
```

### Naming Convention

- `id` must be prefixed with `forge-`.
- The first segment becomes the Claude/Gemini namespace.
- Example: `forge-discussion-analyzer` becomes `forge:discussion-analyzer`.

### Instructions Contract

Every plugin must include:

- Tool approval guidance for `Bash`, `Read`, `python3`, `node`, and `gh` CLI.
- A strict read-only rule.
- A direct `gh` data path for its domain.
- Guardrails against installing `gh` extensions or mutating `~/.config/gh`.
- Scope redirection when the user asks about a different domain.

### `metadata.analyzerDomain`

`metadata.analyzerDomain` drives prompt wording in `src/services/assistants/runtime-rendering.ts`.
Current values are `'discussions'`, `'issues'`, and `'pr-reviews'`.

## Assistant Layouts

| Assistant | Root | Primary Asset | Supplemental Assets |
|-----------|------|---------------|---------------------|
| Claude | `~/.claude` | `commands/{namespace}/{local}.md` | `agents/{id}.md`, `forge/workflows/{local}.md` |
| Copilot | `~/.copilot` | `agents/{id}.agent.md` | `skills/{id}/SKILL.md` |
| Gemini | `~/.gemini` | `commands/{namespace}/{local}.toml` | `agents/{id}.md`, `forge/workflows/{local}.md` |
| Codex | `~/.codex` | `skills/{id}/SKILL.md` | `agents/{id}.md`, `agents/{id}.toml`, `forge/workflows/{local}.md` |

Only workflow reference files remain under `~/.{assistant}/forge/`. The old executable runtime is intentionally gone.

## Rendering System

**File:** `src/services/assistants/runtime-rendering.ts`

Key renderers:

- `renderClaudeCommand`
- `renderClaudeAgent`
- `renderClaudeWorkflow`
- `renderGeminiCommand`
- `renderGeminiAgent`
- `renderGeminiWorkflow`
- `renderCodexSkill`
- `renderCodexAgent`
- `renderCodexAgentToml`

The shared renderer logic does two things:

1. Builds domain-aware prompt copy.
2. Injects the correct read-only `gh` guidance for discussions, issues, or PR reviews.

## Installation Flow

**File:** `src/services/assistants/install.ts`

```text
installAssistantsCommand(cwd)
  → resolve assistant selection
  → for each requested assistant:
      → resolve install layout
      → create missing asset directories
      → remove legacy bundled runtime artifacts
      → render primary + supplemental assets
      → merge Forge-managed content with preserved user customizations
      → remove obsolete legacy files
```

### Managed Content Rules

When writing an asset:

1. New file: write rendered content.
2. Existing managed file: replace only the managed block.
3. Legacy file: migrate the content into the managed/user marker structure.

## CLI Surface

**File:** `src/program.ts`

The public `forge` command is installer-only:

- `--assistants <targets>`
- `--verbose`
- `--cwd <path>`

There is no analyzer execution subcommand anymore.

## Verification

When changing the install architecture:

```bash
npm run build
npm test
node dist/cli.js --assistants codex
```

Check that:

- assets mention direct `gh` usage
- no asset references `forge.mjs` or `--run`
- legacy bundled runtime files are removed on reinstall
- user customization blocks stay intact
