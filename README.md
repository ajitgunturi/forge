# Forge

Forge installs a GitHub Copilot discussion-analysis runtime under `~/.copilot`.

## Install

```bash
npx forge-ai-assist@latest
```

## Use

In Copilot:

1. Run `/agent`
2. Select `forge-discussion-analyzer`
3. Ask a question about GitHub Discussions

Direct runtime usage:

```bash
node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "summarize unresolved discussions from last week"
```

To refresh the fetched data first:

```bash
node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --force-refresh --question "count discussions created since 2026-01-01"
```

## Notes

- This analyzer works with GitHub Discussions only, not GitHub Issues.
- Analysis traces are written to the repository `.forge` directory.
- More development and release details are in [CONTRIBUTING.md](/Users/ajitg/workspace/forge/CONTRIBUTING.md).
