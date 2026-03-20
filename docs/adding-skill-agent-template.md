# Template: Add a New Skill/Agent Across Systems

Use this checklist when adding a new Forge plugin capability that should install into Copilot, Claude, Codex, and Gemini.

## 1) Define Inputs

Fill these before editing code:

- `ENTRY_ID`: stable kebab-case id, for example `forge-release-risk-analyzer`
- `DISPLAY_NAME`: human-readable name
- `PURPOSE`: one-sentence scope
- `QUESTION_HINT`: example user question
- `RUNTIME_DOMAIN`: plugin domain, for example `release-risk`

Rules:

- Keep `ENTRY_ID` stable after release.
- Prefix with `forge-` so Claude and Gemini still expose the namespaced `forge:...` command form.

## 2) Add The Plugin Entry

**File:** `src/services/assistants/summonables.ts`

1. Add a new `ForgePlugin` constant.
2. Add the new entry to `forgePlugins`.
3. Make the `instructions`, `commands`, and `principles` describe direct read-only `gh` usage instead of any Forge backend command.

Template sketch:

```ts
export const entryConst: ForgePlugin = {
  id: 'ENTRY_ID',
  displayName: 'DISPLAY_NAME',
  purpose: 'PURPOSE',
  instructions: [
    'Use this agent for ...',
    'Use read-only `gh ...` as the primary data path.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Capability',
      description: 'What it does',
      benefits: ['Benefit A', 'Benefit B'],
    },
  ],
  commands: [
    {
      name: '/agent ENTRY_ID',
      description: 'Select this agent and ask a question.',
      usage: 'gh ...',
      examples: [
        '/agent -> select ENTRY_ID -> "QUESTION_HINT"',
      ],
    },
  ],
  principles: [
    'Keep the asset compact and use gh as the operational data path.',
  ],
};
```

## 3) Render Assistant Assets

Files:

- `src/services/assistants/runtime-rendering.ts`
- `src/services/assistants/render-entry.ts` if shared markdown helpers need extension

Required behavior:

- Discussions should describe read-only `gh api graphql`.
- Issues should describe read-only `gh issue list` / `gh issue view`.
- PR review comment analyzers should describe read-only `gh pr view` / `gh pr list`, plus read-only `gh api .../pulls/<pr>/comments` when needed.
- Preserve the managed and user-customization markers:
  - `<!-- BEGIN FORGE MANAGED BLOCK -->`
  - `<!-- END FORGE MANAGED BLOCK -->`
  - `<!-- BEGIN USER CUSTOMIZATIONS -->`
  - `<!-- END USER CUSTOMIZATIONS -->`

If the prompt copy is domain-specific, extend `getAnalyzerPromptContext()` and `getAnalyzerExecutionGuidance()`.

## 4) Confirm Per-Assistant Surface Mapping

Existing adapters install all entries from `forgePlugins`.

Verify:

- Copilot: `~/.copilot/agents/ENTRY_ID.agent.md`, `~/.copilot/skills/ENTRY_ID/SKILL.md`
- Claude: `~/.claude/commands/<namespace>/<local>.md`, `~/.claude/agents/ENTRY_ID.md`, `~/.claude/forge/workflows/<local>.md`
- Codex: `~/.codex/skills/ENTRY_ID/SKILL.md`, `~/.codex/agents/ENTRY_ID.md`, `~/.codex/agents/ENTRY_ID.toml`, `~/.codex/forge/workflows/<local>.md`
- Gemini: `~/.gemini/commands/<namespace>/<local>.toml`, `~/.gemini/agents/ENTRY_ID.md`, `~/.gemini/forge/workflows/<local>.md`

## 5) Update Installer UX Copy

**File:** `src/commands/install-assistants.ts`

If success text or installer prompts assume only the current analyzers, update them to include the new plugin or keep the copy generic.

## 6) Add Or Update Tests

At minimum update:

- `tests/unit/services/assistant-exposure.test.ts`
- `tests/unit/services/claude-assistants.test.ts`
- `tests/unit/services/codex-gemini-assistants.test.ts`
- `tests/smoke/cli.test.ts`

Preserve these expectations:

- Correct install paths per assistant
- Installed content references the correct direct `gh` data path
- No installed content references `forge.mjs` or `--run`
- Reinstall preserves user customization blocks
- Reinstall removes legacy bundled runtime artifacts

## 7) Update Docs

At minimum update:

- `README.md`
- `docs/releasing.md`
- `docs/plugin-architecture.md`

## 8) Verify End-To-End

Run:

```bash
npm run build
npm test
node dist/cli.js --assistants codex
```

## Done Criteria

- New plugin appears in `forgePlugins`.
- All four assistant systems install valid assets for the new id.
- Installed assets explain the correct read-only `gh` path for the new plugin.
- Managed and user customization markers remain intact after reinstall.
- Legacy bundled runtime files are still cleaned up on reinstall.
- Unit and smoke tests pass.
