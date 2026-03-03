# Forge

Forge installs a GitHub Copilot discussion-analysis runtime under `~/.copilot`.

## Install

```bash
npx forge-ai-assist@latest
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

## Custom Instructions

Forge installs `forge-discussion-analyzer.agent.md` with a preserved user-customizations block.

- Add your own Copilot instructions inside the `BEGIN USER CUSTOMIZATIONS` / `END USER CUSTOMIZATIONS` section.
- Leave the Forge-managed section unchanged.
- Upgrades replace only the Forge-managed block, so your custom instructions stay intact across reinstalls and updates.

## Notes

- This discussion-analyzer works with GitHub Discussions only, not GitHub Issues.
- Analysis traces are written to the repository `.forge` directory.
- More development and release details are in [CONTRIBUTING.md](/Users/ajitg/workspace/forge/CONTRIBUTING.md).
