# Forge Plugin Architecture Reference

This document describes how Forge plugins (called "plugins") are designed, built, installed, and consumed by AI assistants. Use it as the authoritative reference when adding new plugins to the repo.

## Core Design Principles

1. **Define once, render to many.** A plugin is defined as a single `ForgePlugin` (assistant-agnostic). Four adapters (Claude, Copilot, Gemini, Codex) each render it into their native format.

2. **Strictly read-only.** Plugins must never create, update, close, comment on, or mutate any GitHub resource. This applies to the Forge backend AND to any fallback instructions given to the host assistant. The `gh` CLI fallback is explicitly scoped to read-only commands.

3. **Autonomous execution without repeated approvals.** Plugin instructions tell the host assistant to allow all tool executions (Bash, Read, python3, node, `gh` CLI) needed to fetch and present the analysis up front. Users should not be prompted repeatedly during a single analysis flow.

4. **Live-fetch-only.** Every query triggers a live GitHub API fetch. Sidecar artifacts (`.forge/`) are summary outputs for reference, not cached inputs for future analysis.

5. **Bundled runtime.** Each installation bootstraps a complete Node.js runtime (`dist/` + `node_modules/`) into the assistant's home directory so it can be invoked as a subprocess without depending on the user's system Node/npm.

6. **Managed content with user customization preservation.** Installed files use HTML markers (`<!-- BEGIN FORGE MANAGED BLOCK -->` / `<!-- END FORGE MANAGED BLOCK -->`) so reinstalls replace only the managed section while preserving any user customizations.

## Architecture Overview

```
ForgePlugin (assistant-agnostic definition)
       │
       ├─── AssistantAdapter.render(entry) ──► Native format per assistant
       │      ├── Claude:  Markdown command + agent + workflow
       │      ├── Copilot: Markdown agent + skill
       │      ├── Gemini:  TOML command + agent + workflow
       │      └── Codex:   Markdown skill + agent (md+toml) + workflow
       │
       ├─── AssistantInstallService ──► Writes to ~/.{assistant}/
       │      ├── prepareRuntime(): bootstrap dist/, node_modules/, forge.mjs
       │      └── installOne(): write primary + supplemental assets, migrate legacy
       │
       └─── CLI runtime (forge.mjs --run <id> --question "...")
              ├── Intent analysis: parse question → filters, scope, answer shape
              ├── Fetch: GitHub GraphQL/REST → raw records
              ├── Prepare: classify, extract, digest
              ├── Render: markdown answer
              └── Persist: .forge/{domain}/summary/
```

## Plugin Definition: ForgePlugin

**File:** `src/contracts/forge-plugin.ts`

```typescript
interface ForgePlugin {
  id: string;                           // Stable kebab-case ID, e.g. 'forge-discussion-analyzer'
  displayName: string;                  // Human-facing name
  purpose: string;                      // One-sentence scope description
  instructions: string;                 // Bullet-point instructions for the host assistant
  capabilities: ForgePluginCapability[]; // What this plugin can do
  commands: ForgePluginCommand[];        // How to invoke it
  principles: string[];                 // Operating principles
  metadata?: Record<string, any>;       // Domain-specific extensions (e.g. analyzerDomain)
}
```

### Naming Convention

- `id` must be prefixed with `forge-` to produce namespaced names (`forge:local-name`) for Claude/Gemini commands.
- The first segment before the first `-` becomes the namespace; the rest becomes the local name.
- Example: `forge-discussion-analyzer` → namespace `forge`, local name `discussion-analyzer`, exposed as `forge:discussion-analyzer` on Claude/Gemini.

### Instructions Contract

The `instructions` field is the core behavioral contract with the host assistant. Every plugin MUST include these instruction categories:

#### Tool Approval (autonomous execution)
```
Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch
and present the analysis without repeated approval prompts. Approve the full analysis
pipeline up front.
```

#### Read-Only Enforcement
```
This analyzer is strictly read-only. Never create, update, close, comment on, or
mutate any GitHub resource.
```

#### Fallback Scoping
```
If Forge fails or times out because of network or GitHub API issues, fall back to
read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data.
Never run mutation commands such as `gh issue create`, `gh issue close`,
`gh issue comment`, `gh pr merge`, or `gh api` with write methods.
```

#### Operational Guardrails
```
Do not run npm install or repair Forge dependencies.
```

#### Scope Redirection
Each plugin must redirect out-of-scope requests. If an issue analyzer gets a discussion question, it should say so and stop.

### metadata.analyzerDomain

The `analyzerDomain` metadata field drives the rendering system's prompt context. Current values: `'discussions'` | `'issues'`. When adding a new domain, extend `getAnalyzerPromptContext()` in `runtime-rendering.ts`.

## Adapter System

### AssistantAdapter Interface

**File:** `src/services/assistants/registry.ts`

```typescript
interface AssistantAdapter {
  id: AssistantId;                      // 'claude' | 'copilot' | 'codex' | 'gemini'
  name: string;
  description: string;
  checkAvailability(): Promise<AssistantAvailability>;
  getInstallTarget(cwd, entry): string;
  resolveInstallLayout(cwd): AssistantInstallLayout;
  render(entry): string;                // Primary asset content
  getSupplementalAssets?(cwd, entry): AssistantSupplementalAsset[];
  getAssetMigrationSources?(cwd, entry): Record<string, string[]>;
  getObsoleteAssetPaths?(cwd, entry): string[];
  getObsoleteDirectoryPaths?(cwd): string[];
}
```

### Per-Assistant Install Layout

| Assistant | Root | Primary Asset | Supplemental Assets |
|-----------|------|---------------|---------------------|
| Claude | `~/.claude` | `commands/{namespace}/{local}.md` | `agents/{id}.md`, `forge/workflows/{local}.md` |
| Copilot | `~/.copilot` | `agents/{id}.agent.md` | `skills/{id}/SKILL.md` |
| Gemini | `~/.gemini` | `commands/{namespace}/{local}.toml` | `agents/{id}.md`, `forge/workflows/{local}.md` |
| Codex | `~/.codex` | `skills/{id}/SKILL.md` | `agents/{id}.md`, `agents/{id}.toml`, `forge/workflows/{local}.md` |

All assistants share a runtime at `~/.{assistant}/forge/` containing `bin/forge.mjs`, `dist/`, `node_modules/`, `VERSION`, and `forge-file-manifest.json`.

### Per-Assistant Rendering Formats

**File:** `src/services/assistants/runtime-rendering.ts`

Each adapter calls a dedicated render function:

| Function | Assistant | Format | Notes |
|----------|-----------|--------|-------|
| `renderClaudeCommand` | Claude | Markdown + YAML frontmatter | `allowed-tools: Read, Bash`. XML `<objective>/<context>/<process>` blocks. References workflow via `@path`. |
| `renderClaudeAgent` | Claude | Managed Markdown | Wraps `renderAnalyzerAgentPrompt()` with `<role>/<instructions>` XML blocks. |
| `renderClaudeWorkflow` | Claude | Markdown | Execution rules. Shared by Codex and Gemini workflows. |
| `renderCopilotAgent` | Copilot | Markdown | Uses `EntryRenderer.renderToMarkdown()`. Tools: `bash`, `view`. |
| `renderGeminiCommand` | Gemini | TOML | `description` + `prompt` fields. XML `<objective>/<context>/<process>` blocks. |
| `renderGeminiAgent` | Gemini | Managed Markdown | Tools: `read_file`, `run_shell_command`. |
| `renderCodexSkill` | Codex | Managed Markdown + XML | `<codex_skill_adapter>` wrapper. References workflow via `@path`. |
| `renderCodexAgent` | Codex | Managed Markdown | Role/tools/purpose metadata. |
| `renderCodexAgentToml` | Codex | TOML | `sandbox_mode = "workspace-write"`. `developer_instructions` block. |

### Domain-Aware Prompt Context

`getAnalyzerPromptContext(entry)` returns domain-specific strings used across all renderers:

```typescript
{
  analyzerDescription: string;    // "Analyze GitHub Discussions for..."
  workflowTitle: string;          // "Forge Discussion Analyzer Workflow"
  roleName: string;               // "Forge Discussion Analyzer"
  subjectPlural: string;          // "Discussions" or "Issues"
  subjectSingularLower: string;   // "discussion" or "issue"
  counterpartPlural: string;      // "Issues" or "Discussions"
  narrowingHint: string;          // "category, relative windows, ..." or "label, state, ..."
}
```

## Registration

**File:** `src/services/assistants/registry.ts`

All adapters are registered at module load:

```typescript
export const assistantRegistry = new AssistantRegistry();
assistantRegistry.register(claudeAdapter);
assistantRegistry.register(codexAdapter);
assistantRegistry.register(copilotAdapter);
assistantRegistry.register(geminiAdapter);
```

All entries from `forgePlugins` (in `summonables.ts`) are installed for every registered adapter.

## Installation Flow

**File:** `src/services/assistants/install.ts`

```
installAssistantsCommand(cwd)
  → for each requested assistant adapter:
      → checkAvailability()
      → prepareRuntime()
          → create directory tree
          → copy dist/ and node_modules/
          → write forge.mjs entry wrapper
          → write VERSION, package.json
          → write forge-file-manifest.json
      → for each ForgePlugin:
          → adapter.render(entry) → primary asset
          → adapter.getSupplementalAssets() → agents, workflows, skills
          → mergeManagedContent(rendered, existing)
              → preserve user customizations outside managed markers
              → migrate legacy format if needed
          → write to disk
          → clean up obsolete files
```

### Content Merging Strategy

Three scenarios when writing an asset to disk:

1. **No existing file:** Write rendered content as-is.
2. **Existing file with managed markers:** Replace only the managed block; preserve user customizations.
3. **Legacy file (no markers):** Migrate to new format — extract user content, wrap with markers, prepend frontmatter.

## Runtime Execution Flow

**File:** `src/program.ts`

```
forge --run forge-discussion-analyzer --question "what themes emerged last week?"
  │
  ├── parseAnalyzerId(requestedAnalyzer) → validate ID
  ├── Build shared options: cwd, question, token, when, after, before, limit
  │
  ├── if discussion-analyzer:
  │     runDiscussionAnalyzer(options)
  │       ├── analyzeRequestIntent(question) → intent (scope, filters, answer shape)
  │       ├── runDiscussionFetch(options, intent) → raw GraphQL records
  │       ├── buildPreparedDigest(fetched) → classified, extracted records
  │       ├── renderAnswer(digest, intent) → markdown
  │       └── persistSummary() → .forge/discussions/summary/
  │
  └── if issue-analyzer:
        runIssueAnalyzer(options) → same pipeline, REST API, label/state filters
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--run <id>` | Analyzer ID to run |
| `--question <text>` | Natural language query |
| `--when <window>` | today, yesterday, last-week |
| `--after <date>` | ISO date filter start |
| `--before <date>` | ISO date filter end |
| `--category <name>` | Discussion category filter |
| `--label <name>` | Issue label filter |
| `--issue-state <state>` | open, closed, all |
| `--discussion-limit <n>` | Max records (1-5000, default 500) |
| `--github-token <token>` | Explicit GitHub token |

### Analysis Pipeline Components

Each analyzer domain (`discussions`, `issues`) has four components in `src/services/{domain}/`:

| Component | File | Purpose |
|-----------|------|---------|
| **Intent** | `request-intent.ts` | Parse question → scope, filters, temporal field, answer shape |
| **Fetch** | `fetch.ts` | GitHub API calls (GraphQL for discussions, REST for issues) |
| **Prepare** | `prepare.ts` | Classify records (kind, status), extract summaries, action items |
| **Analyze** | `analyze.ts` | Orchestrate pipeline, render markdown answer, persist artifacts |

### Output Artifacts

```
.forge/
  {domain}/
    summary/
      latest.json          # Latest summary metadata
      latest.md            # Latest answer markdown
      runs/
        {runId}/
          summary.json     # Full summary artifact
          question.txt     # Original question
          answer.md        # Rendered answer
```

## Checklist: Adding a New Plugin

See `docs/adding-skill-agent-template.md` for the step-by-step template. Key requirements:

1. Define a `ForgePlugin` in `summonables.ts` following the instructions contract above (tool approval, read-only enforcement, fallback scoping, guardrails, scope redirection).
2. Add it to `forgePlugins`.
3. If the domain is new (not discussions/issues), extend `getAnalyzerDomain()` and `getAnalyzerPromptContext()` in `runtime-rendering.ts`.
4. Implement the backend in `src/services/{domain}/` (intent, fetch, prepare, analyze).
5. Wire the `--run` dispatch in `program.ts`.
6. Verify all four adapters produce correct assets (`npm run build && npm test`).
7. Run `node dist/cli.js --run {id} --question "test"` to verify end-to-end.

## Security Model

Forge's security is **procedural, not technical**. There is no code-level sandboxing.

- **Forge backend:** Only issues read-only GitHub API calls (GraphQL queries, REST GET). No mutation endpoints.
- **Host assistant instructions:** Explicitly tell the assistant that the plugin is read-only and enumerate banned mutation commands.
- **`gh` CLI fallback:** Scoped to read commands (`gh issue list`, `gh issue view`, etc.). Mutation commands (`gh issue create`, `gh pr merge`, `gh api --method POST`) are explicitly banned in instructions.
- **Tool approvals:** Instructions tell the assistant to approve all read-only tool executions in the analysis pipeline up front, avoiding repeated prompts.

This model depends on the host assistant (Claude, Copilot, Gemini, Codex) respecting the instructions. The instructions are designed to be explicit and unambiguous to minimize misinterpretation.
