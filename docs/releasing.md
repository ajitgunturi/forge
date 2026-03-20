# Releasing Forge

## Quick Steps

1. Publish npm:

```bash
export NPM_TOKEN=your_npm_token_here
make release v1.0.0
```

This command:

- publishes npm
- pushes the current branch
- creates or reuses the matching `vX.Y.Z` tag
- pushes the tag
- creates or updates the GitHub Release
- generates release notes from commits since the previous tag
- appends any optional manual addendum from [`.github-release-notes.md`](/Users/ajitg/workspace/forge/.github-release-notes.md)

2. Verify the public install:

```bash
npx forge-ai-assist@latest
npm_config_prefer_online=true npx forge-ai-assist@latest
```

Expected result:

- `~/.copilot/agents/forge-discussion-analyzer.agent.md` exists
- `~/.claude/commands/forge/discussion-analyzer.md` exists
- `~/.codex/skills/forge-discussion-analyzer/SKILL.md` exists
- `~/.gemini/commands/forge/discussion-analyzer.toml` exists
- `~/.claude/forge/workflows/discussion-analyzer.md` exists
- `~/.copilot/forge/bin/forge.mjs` does not exist
- `~/.claude/forge/bin/forge.mjs` does not exist
- users can add their own instructions inside the preserved user-customizations block without losing them on upgrade

## Breaking Change Reminder

Forge no longer ships the assistant-side bundled runtime, and `forge --run ...` is intentionally gone.
Release notes should call out that assistants now execute read-only `gh` commands directly through the installed assets.

## Optional Split Flow

If you need to handle GitHub tagging separately, the fallback still exists:

```bash
make release-tag v1.0.0
```

This path uses the same release script, so it still regenerates GitHub release notes from commit history.
