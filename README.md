# Forge

Forge installs a GitHub Copilot discussion-analysis runtime under `~/.copilot`, Claude assets under `~/.claude`, Codex assets under `~/.codex`, and Gemini assets under `~/.gemini`.

## Install

```bash
npx forge-ai-assist@latest
```

When run in a terminal, Forge will ask whether to install `copilot`, `claude`, `codex`, `gemini`, or `all`.
For automation, you can skip the prompt:

```bash
npx forge-ai-assist@latest --assistants all
npx forge-ai-assist@latest --assistants copilot
npx forge-ai-assist@latest --assistants claude
npx forge-ai-assist@latest --assistants codex
npx forge-ai-assist@latest --assistants gemini
```

If npm keeps serving a stale cached release, force an online refresh:

```bash
npm_config_prefer_online=true npx forge-ai-assist@latest
```

## Use

In Copilot:

1. Run `/agent`
2. Select `forge-discussion-analyzer`
3. Ask a question about GitHub Discussions

For `gh copilot`, Forge also installs a matching skill at `~/.copilot/skills/forge-discussion-analyzer/SKILL.md` so agent delegation resolves back to the same Forge command instead of failing with `Skill not found`.

In Claude Code:

1. Use the installed `forge:discussion-analyzer` command
2. The command delegates to the installed `forge-discussion-analyzer` agent and the runtime bundle under `~/.claude/forge`
3. Ask a question about GitHub Discussions

In Codex:

1. Use the installed `$forge-discussion-analyzer` skill from `~/.codex/skills/forge-discussion-analyzer/SKILL.md`
2. Codex also gets a matching agent and agent TOML under `~/.codex/agents/`
3. Ask a question about GitHub Discussions

In Gemini:

1. Use the installed `forge:discussion-analyzer` command from `~/.gemini/commands/forge/discussion-analyzer.toml`
2. Gemini also gets a matching agent under `~/.gemini/agents/`
3. Ask a question about GitHub Discussions

## Custom Instructions

Forge installs:
- `~/.copilot/agents/forge-discussion-analyzer.agent.md`
- `~/.copilot/skills/forge-discussion-analyzer/SKILL.md`
- `~/.claude/commands/forge/discussion-analyzer.md`
- `~/.claude/agents/forge-discussion-analyzer.md`
- `~/.codex/skills/forge-discussion-analyzer/SKILL.md`
- `~/.codex/agents/forge-discussion-analyzer.md`
- `~/.codex/agents/forge-discussion-analyzer.toml`
- `~/.gemini/commands/forge/discussion-analyzer.toml`
- `~/.gemini/agents/forge-discussion-analyzer.md`

The markdown assets include a preserved user-customizations block.

- Add your own Copilot instructions inside the `BEGIN USER CUSTOMIZATIONS` / `END USER CUSTOMIZATIONS` section.
- Add your own Claude instructions inside the same markers in the Claude command or agent files.
- Add your own Codex instructions inside the same markers in the Codex skill file.
- Add your own Gemini instructions inside the same markers in the Gemini agent file.
- Leave the Forge-managed section unchanged.
- Upgrades replace only the Forge-managed block, so your custom instructions stay intact across reinstalls and updates.

## Notes

- This discussion-analyzer works with GitHub Discussions only, not GitHub Issues.
- Analysis traces are written to the repository `.forge` directory.
- Forge installs into `~/.copilot`, `~/.claude`, `~/.codex`, and `~/.gemini`. It does not install any files under `~/.config/gh`.
- If Forge hits a network or GitHub API timeout, the installed Copilot agent is expected to report the Forge failure and stop rather than falling back to raw `gh api` calls.
- More development and release details are in [CONTRIBUTING.md](/Users/ajitg/workspace/forge/CONTRIBUTING.md).
