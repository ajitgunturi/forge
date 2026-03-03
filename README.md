# Forge AI Assist

Forge installs GitHub Copilot summonables and runs Forge-managed GitHub Discussions workflows from a local repository.

## Install

Run Forge directly without a global install:

```bash
npx forge-ai-assist@latest
```

After installation, Copilot should discover:

- `forge-agent`
- `forge-discussion-analyzer`

The published binary name is:

```bash
forge
```

## Local Development

From this repository:

```bash
npm install
npm run build
npm link
forge
```

## GitHub Discussions

Forge's discussions workflows require either `GH_TOKEN` or `GITHUB_TOKEN`:

```bash
export GH_TOKEN="$(gh auth token)"
forge --fetch-discussions --when today
forge --run-summonable forge-discussion-analyzer --question "What recurring issues show up this week?"
```

## Updating

To use the latest published version:

```bash
npx forge-ai-assist@latest
```

To confirm the installed CLI version:

```bash
forge --version
```

Maintainer release steps live in [docs/releasing.md](/Users/ajitg/workspace/forge/docs/releasing.md).
