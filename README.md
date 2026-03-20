# Forge

Forge installs assistant-native assets under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.

The `forge` CLI installs and removes assistant-native assets. After installation, the assistant files tell Copilot, Claude, Codex, and Gemini to use read-only `gh`/`git` commands directly:

- Discussions: `gh api graphql`
- Issues: `gh issue list` / `gh issue view`
- PR review comments: `gh pr view` / `gh pr list`, plus read-only `gh api` when inline review comments are needed
- Commit Craft Coach: `git log` / `git diff --stat` for commit quality coaching
- PR Architect: `gh pr list --json` / `gh pr view --json` for PR structure coaching
- Review Quality Coach: `gh api` for code review quality coaching

## Install

```bash
npx forge-ai-assist@latest
```

By default, Forge installs the **core** plugin group (Discussion Analyzer, Issue Analyzer, PR Comments Analyzer). To add elevate plugins:

```bash
npx forge-ai-assist@latest --plugins elevate
npx forge-ai-assist@latest --plugins all
```

When run in a terminal, Forge asks whether to install `copilot`, `claude`, `codex`, `gemini`, or `all`.
For automation, you can skip the prompt:

```bash
npx forge-ai-assist@latest --assistants all
npx forge-ai-assist@latest --assistants copilot
npx forge-ai-assist@latest --assistants claude --plugins all
```

## Uninstall

```bash
npx forge-ai-assist@latest --uninstall
npx forge-ai-assist@latest --uninstall --assistants claude
npx forge-ai-assist@latest --uninstall --plugins elevate
```

Uninstall removes the Forge-managed assistant assets for the selected targets and prunes empty Forge-owned directories when possible.
It also cleans up legacy bundled runtime leftovers from older releases, while leaving unrelated assistant files and `~/.config/gh` alone.

If npm keeps serving a stale cached release, force an online refresh:

```bash
npm_config_prefer_online=true npx forge-ai-assist@latest
```

## Use

In GitHub Copilot:

1. Run `/agent`
2. Select an agent: `forge-discussion-analyzer`, `forge-issue-analyzer`, `forge-pr-comments-analyzer`, `forge-commit-craft-coach`, `forge-pr-architect`, or `forge-review-quality-coach`
3. Ask a question about the selected domain

For `gh copilot`, Forge also installs matching skills under `~/.copilot/skills/`.

In Claude Code:

1. Use a command: `forge:discussion-analyzer`, `forge:issue-analyzer`, `forge:pr-comments-analyzer`, `forge:commit-craft-coach`, `forge:pr-architect`, or `forge:review-quality-coach`
2. Claude follows the installed workflow file under `~/.claude/forge/workflows/`
3. The workflow runs read-only `gh`/`git` commands in the current repository

In Codex:

1. Use a skill: `$forge-discussion-analyzer`, `$forge-issue-analyzer`, `$forge-pr-comments-analyzer`, `$forge-commit-craft-coach`, `$forge-pr-architect`, or `$forge-review-quality-coach`
2. Codex also gets matching agent files under `~/.codex/agents/`
3. The installed skill and workflow instruct Codex to run read-only `gh`/`git` commands directly

In Gemini:

1. Use a command: `forge:discussion-analyzer`, `forge:issue-analyzer`, `forge:pr-comments-analyzer`, `forge:commit-craft-coach`, `forge:pr-architect`, or `forge:review-quality-coach`
2. Gemini also gets matching agents under `~/.gemini/agents/`
3. The installed command prompt points Gemini at the same read-only `gh`/`git` workflow

## Custom Instructions

Forge installs managed files such as:

- `~/.copilot/agents/forge-discussion-analyzer.agent.md`
- `~/.copilot/skills/forge-discussion-analyzer/SKILL.md`
- `~/.claude/commands/forge/discussion-analyzer.md`
- `~/.claude/agents/forge-discussion-analyzer.md`
- `~/.claude/forge/workflows/discussion-analyzer.md`
- `~/.codex/skills/forge-discussion-analyzer/SKILL.md`
- `~/.codex/agents/forge-discussion-analyzer.md`
- `~/.codex/agents/forge-discussion-analyzer.toml`
- `~/.codex/forge/workflows/discussion-analyzer.md`
- `~/.gemini/commands/forge/discussion-analyzer.toml`
- `~/.gemini/agents/forge-discussion-analyzer.md`
- `~/.gemini/forge/workflows/discussion-analyzer.md`

The same pattern applies for `forge-issue-analyzer`, `forge-pr-comments-analyzer`, `forge-commit-craft-coach`, `forge-pr-architect`, and `forge-review-quality-coach`.

These files include a preserved user-customizations block:

- Add your own Copilot instructions inside the `BEGIN USER CUSTOMIZATIONS` / `END USER CUSTOMIZATIONS` section.
- Add your own Claude instructions inside the same markers in the Claude command or agent files.
- Add your own Codex instructions inside the same markers in the Codex skill file.
- Add your own Gemini instructions inside the same markers in the Gemini agent file.
- Leave the Forge-managed section unchanged.
- Reinstalls replace only the Forge-managed block, so your custom instructions stay intact.

## Notes

- **Core plugins** (installed by default):
  - `forge-discussion-analyzer` works with GitHub Discussions only.
  - `forge-issue-analyzer` works with GitHub Issues only.
  - `forge-pr-comments-analyzer` works with GitHub PR review comments only.
- **Elevate plugins** (install with `--plugins elevate` or `--plugins all`):
  - `forge-commit-craft-coach` coaches on commit quality using Git history analysis.
  - `forge-pr-architect` coaches on PR structure and reviewability using PR metrics.
  - `forge-review-quality-coach` coaches on code review depth and actionability.
- Forge installs into `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`. It does not install files under `~/.config/gh`.
- Assistant reinstall cleans the legacy bundled runtime files if they still exist from older Forge versions.
- More development and release details are in [CONTRIBUTING.md](/Users/ajitg/workspace/forge/CONTRIBUTING.md).
