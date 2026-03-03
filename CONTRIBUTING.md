# Contributing

## Local Development

Install dependencies, build, and run tests:

```bash
npm install
npm run build
npm test
```

## Release

Publish npm:

```bash
export NPM_TOKEN=your_npm_token_here
make release v1.0.0
```

Push the matching tag and GitHub Release:

```bash
make release-tag v1.0.0
```

## Runtime Notes

- Forge installs the Copilot runtime globally under `~/.copilot`.
- Copilot discovers `forge-discussion-analyzer` from `~/.copilot/agents`.
- Repository-scoped discussion artifacts and analysis traces are written under `.forge`.
