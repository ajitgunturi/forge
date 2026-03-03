# Phase 10 UAT: Copilot Runtime Bootstrap And Install UX

## Test 1: Fresh-machine global install

1. Start with a machine or temp home directory where `~/.copilot/agents` does not exist
2. Run `npx forge-ai-assist@latest`

Expected:

- Forge installs into `~/.copilot`
- `~/.copilot/agents/forge-agent.agent.md` exists
- `~/.copilot/agents/forge-discussion-analyzer.agent.md` exists
- `~/.copilot/forge/bin/forge.mjs` exists
- `~/.copilot/forge/VERSION` exists
- `~/.copilot/forge/forge-file-manifest.json` exists

## Test 2: Bundled runtime invocation

1. Export `GH_TOKEN` or `GITHUB_TOKEN`
2. Run:

```bash
node "$HOME/.copilot/forge/bin/forge.mjs" --fetch-discussions --when today
```

Expected:

- Forge runs from the bundled runtime under `~/.copilot`
- Discussion artifacts are written under the current repository's `.forge` sidecar

## Test 3: Copilot /agent discovery

1. Restart or refresh Copilot after install
2. Open `/agent`
3. Select `forge-discussion-analyzer`

Expected:

- Copilot discovers the installed Forge agents from `~/.copilot/agents`
- The analyzer instructions reference the bundled runtime under `~/.copilot/forge`
