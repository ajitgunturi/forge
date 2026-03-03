# Releasing Forge

## Quick Steps

1. Publish npm:

```bash
export NPM_TOKEN=your_npm_token_here
make release v1.0.0
```

This one command now:
- publishes npm
- pushes the current branch
- creates or reuses the matching `vX.Y.Z` tag
- pushes the tag
- creates the GitHub Release if it does not already exist

2. Verify the public install:

```bash
npx forge-ai-assist@latest
npm_config_prefer_online=true npx forge-ai-assist@latest
node "$HOME/.copilot/forge/bin/forge.mjs" --help
```

Expected result:

- `~/.copilot/agents/forge-discussion-analyzer.agent.md` exists
- `~/.copilot/forge/node_modules` exists
- no manual `npm install` is needed inside `~/.copilot/forge`
- users can add their own instructions inside the preserved user-customizations block of `forge-discussion-analyzer.agent.md` without losing them on upgrade

## Optional split flow

If you need to handle GitHub tagging separately, the old fallback still exists:

```bash
make release-tag v1.0.0
```
