# Usage Guide

This guide covers per-assistant usage details, file locations, and custom instructions.

## Using Forge Plugins

### GitHub Copilot

1. Run `/agent` in the Copilot chat
2. Select an agent (e.g., `forge-discussion-analyzer`)
3. Ask a question about the selected domain

For `gh copilot`, Forge also installs matching skills under `~/.copilot/skills/`.

### Claude Code

1. Use a slash command: `/forge:discussion-analyzer`, `/forge:issue-analyzer`, `/forge:pr-comments-analyzer`, `/forge:commit-craft-coach`, `/forge:pr-architect`, `/forge:review-quality-coach`, or `/forge:release-notes-generator`
2. Claude follows the installed workflow file under `~/.claude/forge/workflows/`
3. The workflow runs read-only `gh`/`git` commands in the current repository

### Codex

1. Use a skill: `$forge-discussion-analyzer`, `$forge-issue-analyzer`, `$forge-pr-comments-analyzer`, `$forge-commit-craft-coach`, `$forge-pr-architect`, `$forge-review-quality-coach`, or `$forge-release-notes-generator`
2. Codex also gets matching agent files under `~/.codex/agents/`
3. The installed skill and workflow instruct Codex to run read-only `gh`/`git` commands directly

### Gemini CLI

1. Use a command: `forge:discussion-analyzer`, `forge:issue-analyzer`, `forge:pr-comments-analyzer`, `forge:commit-craft-coach`, `forge:pr-architect`, `forge:review-quality-coach`, or `forge:release-notes-generator`
2. Gemini also gets matching agents under `~/.gemini/agents/`
3. The installed command prompt points Gemini at the same read-only `gh`/`git` workflow

## Installed File Locations

Forge installs managed files into each assistant's config directory:

| Assistant | Root | Files installed per plugin |
|-----------|------|--------------------------|
| Copilot | `~/.copilot` | `agents/{id}.agent.md`, `skills/{id}/SKILL.md` |
| Claude | `~/.claude` | `commands/forge/{name}.md`, `agents/{id}.md`, `forge/workflows/{name}.md` |
| Codex | `~/.codex` | `skills/{id}/SKILL.md`, `agents/{id}.md`, `agents/{id}.toml`, `forge/workflows/{name}.md` |
| Gemini | `~/.gemini` | `commands/forge/{name}.toml`, `agents/{id}.md`, `forge/workflows/{name}.md` |

Example for `forge-discussion-analyzer`:

```text
~/.copilot/agents/forge-discussion-analyzer.agent.md
~/.copilot/skills/forge-discussion-analyzer/SKILL.md
~/.claude/commands/forge/discussion-analyzer.md
~/.claude/agents/forge-discussion-analyzer.md
~/.claude/forge/workflows/discussion-analyzer.md
~/.codex/skills/forge-discussion-analyzer/SKILL.md
~/.codex/agents/forge-discussion-analyzer.md
~/.codex/agents/forge-discussion-analyzer.toml
~/.codex/forge/workflows/discussion-analyzer.md
~/.gemini/commands/forge/discussion-analyzer.toml
~/.gemini/agents/forge-discussion-analyzer.md
~/.gemini/forge/workflows/discussion-analyzer.md
```

## Custom Instructions

Every installed file includes a preserved user-customizations block:

```markdown
<!-- BEGIN USER CUSTOMIZATIONS -->
Your custom instructions here — Forge will never overwrite this section.
<!-- END USER CUSTOMIZATIONS -->
```

- Add your own instructions inside the `BEGIN USER CUSTOMIZATIONS` / `END USER CUSTOMIZATIONS` markers
- Leave the Forge-managed section unchanged
- Reinstalls replace only the Forge-managed block, so your custom instructions stay intact
- This works across all four assistants

## Plugin Reference

### Core Plugins (installed by default)

| Plugin | Domain | Data source |
|--------|--------|-------------|
| `forge-discussion-analyzer` | GitHub Discussions | `gh api graphql` |
| `forge-issue-analyzer` | GitHub Issues | `gh issue list`, `gh issue view` |
| `forge-pr-comments-analyzer` | PR review comments | `gh pr view`, `gh pr list`, `gh api` |

### Elevate Plugins (`--plugins elevate`)

| Plugin | Domain | Data source |
|--------|--------|-------------|
| `forge-commit-craft-coach` | Commit quality | `git log`, `git diff --stat` |
| `forge-pr-architect` | PR structure | `gh pr list --json`, `gh pr view --json` |
| `forge-review-quality-coach` | Code review depth | `gh api` pulls endpoints |

### Ops Plugins (`--plugins ops`)

| Plugin | Domain | Data source |
|--------|--------|-------------|
| `forge-release-notes-generator` | Release notes | `git log`, `gh pr list`, `gh issue list` |

## Troubleshooting

### npm serves a stale cached version

```bash
npm_config_prefer_online=true npx forge-ai-assist@latest
```

### Forge doesn't install into `~/.config/gh`

This is by design. Forge installs into `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini` only.

### Legacy runtime cleanup

If you used an older version of Forge that shipped a bundled runtime, reinstalling will automatically clean up those legacy files (`forge/bin`, `forge/dist`, `forge/node_modules`, etc.).
