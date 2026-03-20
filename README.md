# Forge

Forge installs assistant-native assets under `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`.

The `forge` CLI installs and removes assistant-native assets. After installation, the assistant files tell Copilot, Claude, Codex, and Gemini to use read-only `gh` commands directly:

- Discussions: `gh api graphql`
- Issues: `gh issue list` / `gh issue view`
- PR review comments: `gh pr view` / `gh pr list`, plus read-only `gh api` when inline review comments are needed

## Install

```bash
npx forge-ai-assist@latest
```

When run in a terminal, Forge asks whether to install `copilot`, `claude`, `codex`, `gemini`, or `all`.
For automation, you can skip the prompt:

```bash
npx forge-ai-assist@latest --assistants all
npx forge-ai-assist@latest --assistants copilot
npx forge-ai-assist@latest --assistants claude
npx forge-ai-assist@latest --assistants codex
npx forge-ai-assist@latest --assistants gemini
```

## Uninstall

```bash
npx forge-ai-assist@latest --uninstall
npx forge-ai-assist@latest --uninstall --assistants claude
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
2. Select `forge-discussion-analyzer`, `forge-issue-analyzer`, or `forge-pr-comments-analyzer`
3. Ask a question about GitHub Discussions, GitHub Issues, or PR review comments

For `gh copilot`, Forge also installs matching skills under `~/.copilot/skills/`.

In Claude Code:

1. Use `forge:discussion-analyzer`, `forge:issue-analyzer`, or `forge:pr-comments-analyzer`
2. Claude follows the installed workflow file under `~/.claude/forge/workflows/`
3. The workflow runs read-only `gh` commands in the current repository

In Codex:

1. Use `$forge-discussion-analyzer`, `$forge-issue-analyzer`, or `$forge-pr-comments-analyzer`
2. Codex also gets matching agent files under `~/.codex/agents/`
3. The installed skill and workflow instruct Codex to run read-only `gh` commands directly

In Gemini:

1. Use `forge:discussion-analyzer`, `forge:issue-analyzer`, or `forge:pr-comments-analyzer`
2. Gemini also gets matching agents under `~/.gemini/agents/`
3. The installed command prompt points Gemini at the same read-only `gh` workflow

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

The same pattern applies for `forge-issue-analyzer` and `forge-pr-comments-analyzer`.

These files include a preserved user-customizations block:

- Add your own Copilot instructions inside the `BEGIN USER CUSTOMIZATIONS` / `END USER CUSTOMIZATIONS` section.
- Add your own Claude instructions inside the same markers in the Claude command or agent files.
- Add your own Codex instructions inside the same markers in the Codex skill file.
- Add your own Gemini instructions inside the same markers in the Gemini agent file.
- Leave the Forge-managed section unchanged.
- Reinstalls replace only the Forge-managed block, so your custom instructions stay intact.

## Notes

- `forge-discussion-analyzer` works with GitHub Discussions only.
- `forge-issue-analyzer` works with GitHub Issues only.
- `forge-pr-comments-analyzer` works with GitHub PR review comments only.
- Forge installs into `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`. It does not install files under `~/.config/gh`.
- Assistant reinstall cleans the legacy bundled runtime files if they still exist from older Forge versions.
- More development and release details are in [CONTRIBUTING.md](/Users/ajitg/workspace/forge/CONTRIBUTING.md).
