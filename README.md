# Forge AI Assist

Forge installs a self-contained GitHub Copilot runtime under `~/.copilot` and runs Forge-managed GitHub Discussions workflows from there.

## Install

Run the installer:

```bash
npx forge-ai-assist@latest
```

This installs Forge globally into:

```bash
~/.copilot
```

Forge bootstraps:

- `~/.copilot/agents/forge-agent.agent.md`
- `~/.copilot/agents/forge-discussion-analyzer.agent.md`
- `~/.copilot/forge/dist/*`
- `~/.copilot/forge/bin/forge.mjs`
- `~/.copilot/forge/VERSION`
- `~/.copilot/forge/forge-file-manifest.json`

After installation, Copilot should discover:

- `forge-agent`
- `forge-discussion-analyzer`

The bundled runtime entry used by installed agents is:

```bash
node "$HOME/.copilot/forge/bin/forge.mjs"
```

## Local Development

From this repository:

```bash
npm install
npm run build
npm link
forge
```

## Verify Install

Check the installed runtime:

```bash
ls ~/.copilot/agents
ls ~/.copilot/forge/bin
cat ~/.copilot/forge/VERSION
```

You should see the two Forge agent files plus the bundled runtime entry at `~/.copilot/forge/bin/forge.mjs`.

## GitHub Discussions

Forge's discussions workflows require either `GH_TOKEN` or `GITHUB_TOKEN`:

```bash
export GH_TOKEN="$(gh auth token)"
node "$HOME/.copilot/forge/bin/forge.mjs" --fetch-discussions --when today
node "$HOME/.copilot/forge/bin/forge.mjs" --run-summonable forge-discussion-analyzer --question "What recurring issues show up this week?"
```

## Updating

To use the latest published version:

```bash
npx forge-ai-assist@latest
```

To confirm the installed CLI version:

```bash
node "$HOME/.copilot/forge/bin/forge.mjs" --version
```

Maintainer release steps live in [docs/releasing.md](/Users/ajitg/workspace/forge/docs/releasing.md).
