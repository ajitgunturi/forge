# Template: Add a New Skill/Agent Across Systems

Use this template when adding a new Forge plugin capability that should install into all assistant runtimes (Copilot, Claude, Codex, Gemini).

## 1) Define Inputs

Fill these before editing code:

- `ENTRY_ID`: stable kebab-case id, ex: `forge-release-risk-analyzer`
- `DISPLAY_NAME`: ex: `Forge Release Risk Analyzer`
- `PURPOSE`: one-sentence scope
- `QUESTION_HINT`: what user question this plugin expects
- `RUNTIME_HANDLER`: backend function name, ex: `runReleaseRiskAnalyzer`
- `RUNTIME_DOMAIN`: service folder, ex: `src/services/release-risk/`

Rules:

- Keep `ENTRY_ID` stable after release.
- Prefix with `forge-` to preserve namespace behavior (`forge:...`) for Claude/Gemini commands.

## 2) Add The Plugin Entry

File: `src/services/assistants/plugins.ts`

1. Add a new `ForgePlugin` constant (copy the existing `forgeDiscussionAnalyzerEntry` shape).
2. Add the new entry to `forgePlugins`.

Template snippet:

```ts
export const ENTRY_CONST: ForgePlugin = {
  id: 'ENTRY_ID',
  displayName: 'DISPLAY_NAME',
  purpose: 'PURPOSE',
  instructions: [
    'Instruction 1',
    'Instruction 2',
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
      usage: `${COPILOT_RUNTIME_ENTRY} --run ENTRY_ID --question "<your question>"`,
      examples: [
        '/agent -> select ENTRY_ID -> "QUESTION_HINT"',
      ],
    },
  ],
  principles: [
    'Principle 1',
  ],
};
```

## 3) Add Runtime Backend Wiring

Files:

- `src/program.ts`
- `src/services/<domain>/...` (new backend implementation)

Forge currently supports multiple plugins (`forge-discussion-analyzer`, `forge-issue-analyzer`), so new plugins require dispatch changes.

Minimum update:

1. Implement backend runner (`RUNTIME_HANDLER`) for the new plugin.
2. Extend `--run`/`--run-plugin` dispatch to accept the new `ENTRY_ID`.
3. Keep unknown analyzer error explicit and list valid ids.

## 4) Render Assistant Assets For The New Entry

Files:

- `src/services/assistants/runtime-rendering.ts`
- `src/services/assistants/render-entry.ts` (if shared markdown helpers need extension)

Required behavior:

- Generated command/agent/skill text must execute:
  - `node "$HOME/.<assistant>/forge/bin/forge.mjs" --run ENTRY_ID --question "..."`
- Preserve managed/user customization markers:
  - `<!-- BEGIN FORGE MANAGED BLOCK -->`
  - `<!-- END FORGE MANAGED BLOCK -->`
  - `<!-- BEGIN USER CUSTOMIZATIONS -->`
  - `<!-- END USER CUSTOMIZATIONS -->`

If prompt copy is analyzer-specific, add a dedicated renderer for the new plugin or parameterize existing helpers by `entry.id`.

## 5) Confirm Per-Assistant Surface Mapping

No new adapter is needed for this task. Existing adapters install all entries from `forgePlugins`.

Verify each adapter still produces correct assets for `ENTRY_ID`:

- Copilot (`src/services/assistants/copilot.ts`)
  - Primary: `~/.copilot/agents/ENTRY_ID.agent.md`
  - Supplemental: `~/.copilot/skills/ENTRY_ID/SKILL.md`
- Claude (`src/services/assistants/claude.ts`)
  - Primary command: `~/.claude/commands/<namespace>/<local>.md`
  - Supplemental: `~/.claude/agents/ENTRY_ID.md`
  - Supplemental: `~/.claude/forge/workflows/<local>.md`
- Codex (`src/services/assistants/codex.ts`)
  - Primary skill: `~/.codex/skills/ENTRY_ID/SKILL.md`
  - Supplemental: `~/.codex/agents/ENTRY_ID.md`
  - Supplemental: `~/.codex/agents/ENTRY_ID.toml`
  - Supplemental: `~/.codex/forge/workflows/<local>.md`
- Gemini (`src/services/assistants/gemini.ts`)
  - Primary command: `~/.gemini/commands/<namespace>/<local>.toml`
  - Supplemental: `~/.gemini/agents/ENTRY_ID.md`
  - Supplemental: `~/.gemini/forge/workflows/<local>.md`

Notes:

- `<namespace>/<local>` comes from first `-` split in `ENTRY_ID` via `getPluginRoute`.
- Claude/Gemini command names are namespaced (`forge:local-name`) via `getExposedPluginName`.

## 6) Update Installer UX Copy

File: `src/commands/install-assistants.ts`

If success text references only `forgeDiscussionAnalyzerEntry`, update it to include the new plugin (or make it generic for multi-entry installs).

## 7) Add/Update Tests

At minimum update:

- `tests/unit/services/assistant-exposure.test.ts`
- `tests/unit/services/claude-assistants.test.ts`
- `tests/unit/services/codex-gemini-assistants.test.ts`
- `tests/smoke/cli.test.ts`

If runtime dispatch changes, add/adjust tests around `src/program.ts` behavior and backend execution.

Test expectations to preserve:

- Correct install paths per assistant
- New content references `--run ENTRY_ID`
- Reinstall preserves user customization blocks
- Legacy migration behavior (if old paths are introduced)

## 8) Update Docs

At minimum update:

- `README.md` (usage + installed file list)
- `docs/releasing.md` (release validation checks)

## 9) Verify End-To-End

Run:

```bash
npm run build
npm test
```

Optional manual spot checks:

```bash
node dist/cli.js --assistants codex
node dist/cli.js --run ENTRY_ID --question "QUESTION_HINT"
```

## Done Criteria

- New plugin appears in `forgePlugins`.
- All four assistant systems install valid assets for the new id.
- Runtime `--run ENTRY_ID` executes the correct backend.
- Managed/user customization markers remain intact after reinstall.
- Unit + smoke tests pass.
