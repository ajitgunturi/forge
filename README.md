# Forge

[![npm version](https://img.shields.io/npm/v/forge-ai-assist)](https://www.npmjs.com/package/forge-ai-assist)
[![CI](https://github.com/ajitgunturi/forge/actions/workflows/ci.yml/badge.svg)](https://github.com/ajitgunturi/forge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

**Give your AI coding assistant superpowers over your GitHub workflow.**

Forge is a single CLI that installs plugins into GitHub Copilot, Claude Code, Codex, and Gemini CLI — so every assistant in your toolkit can analyze discussions, review PRs, and coach you on engineering quality. One install, four assistants, zero lock-in.

## Quick Start

```bash
npx forge-ai-assist@latest
```

That's it. Forge asks which assistants you use, installs the plugins, and you're ready.

## What Can You Do With Forge?

### Understand what the community is saying

> *"Summarize the top 5 open discussions and highlight unanswered questions"*

The **Discussion Analyzer** fetches live GitHub Discussions data and gives you a structured summary — no tab-switching required.

### Triage issues faster

> *"Show me open bugs labeled `P0` and group them by component"*

The **Issue Analyzer** pulls live issue data so your assistant can filter, group, and surface what matters.

### Review PRs without context-switching

> *"Analyze review comments on PR #42 — what are the recurring themes?"*

The **PR Comments Analyzer** reads review threads and distills them into actionable patterns.

### Level up your commits

> *"Review my last 10 commits — are they atomic and well-narrated?"*

The **Commit Craft Coach** analyzes your Git history and coaches you toward commits that tell a clear story.

### Ship reviewable PRs

> *"Evaluate my open PR — is it structured for easy review?"*

The **PR Architect** examines PR size, scope, and structure, then coaches you toward PRs reviewers can confidently approve.

### Write better code reviews

> *"Assess my recent reviews — are they specific and architecturally deep?"*

The **Review Quality Coach** analyzes your outgoing reviews and helps you move beyond "LGTM."

### Generate release notes

> *"Generate release notes from v1.1.20 to HEAD"*

The **Release Notes Generator** synthesizes commits, PRs, and issues into structured release notes.

## Install Options

```bash
# Install core plugins (discussions, issues, PR comments)
npx forge-ai-assist@latest

# Add coaching plugins
npx forge-ai-assist@latest --plugins elevate

# Install everything
npx forge-ai-assist@latest --plugins all

# Target a specific assistant
npx forge-ai-assist@latest --assistants claude --plugins all

# Non-interactive (CI-friendly)
npx forge-ai-assist@latest --assistants all --plugins all
```

## Uninstall

```bash
npx forge-ai-assist@latest --uninstall
```

## Check What's Installed

```bash
npx forge-ai-assist@latest status
```

## Plugin Groups

| Group | Plugins | Installed by default? |
|-------|---------|----------------------|
| **Core** | Discussion Analyzer, Issue Analyzer, PR Comments Analyzer | Yes |
| **Elevate** | Commit Craft Coach, PR Architect, Review Quality Coach | `--plugins elevate` |
| **Ops** | Release Notes Generator | `--plugins ops` |

## Supported Assistants

| Assistant | How to invoke a plugin |
|-----------|----------------------|
| **GitHub Copilot** | `/agent` → select a `forge-*` agent |
| **Claude Code** | `/forge:discussion-analyzer`, `/forge:issue-analyzer`, etc. |
| **Codex** | `$forge-discussion-analyzer`, `$forge-issue-analyzer`, etc. |
| **Gemini CLI** | `forge:discussion-analyzer`, `forge:issue-analyzer`, etc. |

## How It Works

Forge doesn't run a background service or proxy your data. It installs lightweight prompt files — agents, skills, and workflows — directly into each assistant's config directory. When you invoke a plugin, your assistant runs read-only `gh` and `git` commands in your current repo and interprets the results. Your data never leaves your machine beyond what `gh` already does.

## Documentation

| Doc | What's in it |
|-----|-------------|
| [Usage Guide](docs/usage-guide.md) | Per-assistant setup, custom instructions, file locations |
| [Plugin Architecture](docs/plugin-architecture.md) | How plugins are defined, rendered, and installed |
| [Adding a Plugin](docs/adding-skill-agent-template.md) | Step-by-step checklist for contributors |
| [Releasing](docs/releasing.md) | Version bump and publish workflow |
| [Contributing](CONTRIBUTING.md) | Dev setup, project structure, and release process |
| [Changelog](CHANGELOG.md) | Release history |

## License

[MIT](LICENSE) — Copyright (c) 2024-2026 Ajit Gunturi
