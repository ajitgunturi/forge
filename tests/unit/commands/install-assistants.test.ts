import { describe, expect, it } from 'vitest';
import {
  buildInteractiveOperationLines,
  buildInteractiveInstallSummary,
  buildSuccessMessage,
  renderInteractiveInstallerScreen,
  resolveInteractiveAssistantChoice,
  renderPluginGroupPicker,
  buildPluginGroupChoices,
  resolvePluginGroupChoice,
} from '../../../src/commands/install-assistants.js';
import {
  forgeCorePlugins,
  forgeElevatePlugins,
  forgeOpsPlugins,
  forgePlugins,
  resolvePluginGroups,
  getPluginGroupInfo,
} from '../../../src/services/assistants/summonables.js';

describe('interactive installer screen', () => {
  it('renders the branded installer header and runtime choices', () => {
    const output = renderInteractiveInstallerScreen('1.1.2');

    expect(output).toContain('Forge v1.1.2');
    expect(output).toContain('Which assistant(s) would you like to install for?');
    expect(output).toContain('1) GitHub Copilot');
    expect(output).toContain('2) Claude Code');
    expect(output).toContain('3) Gemini');
    expect(output).toContain('4) Codex');
    expect(output).toContain('5) All');
  });

  it('maps interactive choices to assistant selections', () => {
    expect(resolveInteractiveAssistantChoice('')).toEqual(['copilot', 'claude', 'codex', 'gemini']);
    expect(resolveInteractiveAssistantChoice('1')).toEqual(['copilot']);
    expect(resolveInteractiveAssistantChoice('2')).toEqual(['claude']);
    expect(resolveInteractiveAssistantChoice('3')).toEqual(['gemini']);
    expect(resolveInteractiveAssistantChoice('4')).toEqual(['codex']);
    expect(resolveInteractiveAssistantChoice('5')).toEqual(['copilot', 'claude', 'codex', 'gemini']);
    expect(resolveInteractiveAssistantChoice('unknown')).toBeNull();
  });

  it('builds an install summary for single-runtime and all-runtime installs', () => {
    expect(buildInteractiveInstallSummary(['codex'])).toContain('Installing for Codex');
    expect(buildInteractiveInstallSummary(['codex'])).toContain('~/.codex');
    expect(buildInteractiveInstallSummary(['copilot', 'claude', 'codex', 'gemini'])).toContain('Installing Forge globally');
  });

  it('resolves plugin groups to the correct plugin sets', () => {
    expect(resolvePluginGroups(['core'])).toEqual(forgeCorePlugins);
    expect(resolvePluginGroups(['elevate'])).toEqual(forgeElevatePlugins);
    expect(resolvePluginGroups(['ops'])).toEqual(forgeOpsPlugins);
    expect(resolvePluginGroups(['core', 'elevate', 'ops'])).toEqual(forgePlugins);
    expect(resolvePluginGroups([])).toEqual([]);

    expect(forgeCorePlugins).toHaveLength(3);
    expect(forgeElevatePlugins).toHaveLength(3);
    expect(forgeOpsPlugins).toHaveLength(1);
    expect(forgePlugins).toHaveLength(7);

    const coreIds = forgeCorePlugins.map((p) => p.id);
    expect(coreIds).toContain('forge-discussion-analyzer');
    expect(coreIds).toContain('forge-issue-analyzer');
    expect(coreIds).toContain('forge-pr-comments-analyzer');

    const elevateIds = forgeElevatePlugins.map((p) => p.id);
    expect(elevateIds).toContain('forge-commit-craft-coach');
    expect(elevateIds).toContain('forge-pr-architect');
    expect(elevateIds).toContain('forge-review-quality-coach');

    const opsIds = forgeOpsPlugins.map((p) => p.id);
    expect(opsIds).toContain('forge-release-notes-generator');
  });

  it('builds interactive result checklists for installer output', () => {
    expect(buildInteractiveOperationLines({
      id: 'codex',
      status: 'success',
      message: 'ok',
      details: ['removed legacy runtime /tmp/.codex/forge/bin/forge.mjs'],
    })).toEqual([
      'Installed skill',
      'Installed agents',
      'Installed workflow',
      'Removed legacy runtime',
    ]);

    expect(buildInteractiveOperationLines({
      id: 'gemini',
      status: 'skipped',
      message: 'already up to date',
    })).toEqual(['Already up to date']);
  });
});

describe('interactive plugin group picker', () => {
  it('renders the plugin group picker with group names and plugin listings', () => {
    const output = renderPluginGroupPicker();

    expect(output).toContain('Which plugin groups would you like to install?');
    expect(output).toContain('1)');
    expect(output).toContain('Core (default)');
    expect(output).toContain('2)');
    expect(output).toContain('3)');
    expect(output).toContain('All');
  });

  it('displays plugin display names from summonables registry', () => {
    const output = renderPluginGroupPicker();

    expect(output).toContain('Forge Discussion Analyzer');
    expect(output).toContain('Forge Issue Analyzer');
    expect(output).toContain('Forge PR Comments Analyzer');
  });

  it('builds choices dynamically from plugin group info', () => {
    const groups = getPluginGroupInfo();
    const choices = buildPluginGroupChoices(groups);

    expect(choices.length).toBeGreaterThanOrEqual(2);
    expect(choices[0].choice).toBe('1');
    expect(choices[0].label).toContain('Core');
    expect(choices[0].groups).toEqual(['core']);

    const allChoice = choices.find((c) => c.label === 'All');
    expect(allChoice).toBeDefined();
    expect(allChoice!.groups).toContain('core');
    expect(allChoice!.groups).toContain('elevate');
    expect(allChoice!.groups).toContain('ops');
  });

  it('resolves choice 1 and empty input to core', () => {
    expect(resolvePluginGroupChoice('')).toEqual(['core']);
    expect(resolvePluginGroupChoice('1')).toEqual(['core']);
  });

  it('resolves choice 2 to core + non-core groups', () => {
    const result = resolvePluginGroupChoice('2');
    expect(result).toContain('core');
    expect(result).toContain('elevate');
    expect(result).toContain('ops');
  });

  it('resolves choice 3 (All) to all groups', () => {
    const result = resolvePluginGroupChoice('3');
    expect(result).toContain('core');
    expect(result).toContain('elevate');
    expect(result).toContain('ops');
  });

  it('returns null for unknown choices', () => {
    expect(resolvePluginGroupChoice('99')).toBeNull();
    expect(resolvePluginGroupChoice('invalid')).toBeNull();
  });
});

describe('buildSuccessMessage (matrix output)', () => {
  it('renders a matrix table with header, separator, and plugin rows', () => {
    const output = buildSuccessMessage(['claude'], ['core']);

    expect(output).toContain('Available Forge plugins:');
    expect(output).toContain('Plugin');
    expect(output).toContain('Claude');
    expect(output).toContain('───');
    expect(output).toContain('Forge Discussion Analyzer');
    expect(output).toContain('Forge Issue Analyzer');
    expect(output).toContain('Forge PR Comments Analyzer');
  });

  it('shows correct invocation names per assistant', () => {
    const output = buildSuccessMessage(['copilot', 'claude', 'codex', 'gemini'], ['core']);

    expect(output).toContain('Copilot');
    expect(output).toContain('Claude');
    expect(output).toContain('Codex');
    expect(output).toContain('Gemini');

    expect(output).toContain('/agent forge-discussion-analyzer');
    expect(output).toContain('/forge:discussion-analyzer');
    expect(output).toContain('$forge-discussion-analyzer');
  });

  it('includes ops group plugins when ops is in plugin groups', () => {
    const output = buildSuccessMessage(['claude'], ['core', 'ops']);

    expect(output).toContain('Forge Release Notes Generator');
    expect(output).toContain('/forge:release-notes-generator');
  });

  it('includes all groups when all groups are selected', () => {
    const output = buildSuccessMessage(['claude'], ['core', 'elevate', 'ops']);

    expect(output).toContain('Forge Discussion Analyzer');
    expect(output).toContain('Forge Commit Craft Coach');
    expect(output).toContain('Forge Release Notes Generator');
  });

  it('shows install hints for missing plugin groups', () => {
    const output = buildSuccessMessage(['claude'], ['core']);

    expect(output).toContain('Install Elevate plugins');
    expect(output).toContain('npx forge-ai-assist@latest --plugins elevate');
    expect(output).toContain('Install Ops plugins');
    expect(output).toContain('npx forge-ai-assist@latest --plugins ops');
  });

  it('does not show install hints when all groups are installed', () => {
    const output = buildSuccessMessage(['claude'], ['core', 'elevate', 'ops']);

    expect(output).not.toContain('Install Elevate plugins');
    expect(output).not.toContain('Install Ops plugins');
  });

  it('only shows columns for requested assistants', () => {
    const output = buildSuccessMessage(['claude'], ['core']);

    expect(output).toContain('Claude');
    expect(output).not.toContain('Copilot');
    expect(output).not.toContain('Codex');
    expect(output).not.toContain('Gemini');
  });

  it('returns a fallback message when no plugins are selected', () => {
    const output = buildSuccessMessage(['claude'], []);
    expect(output).toBe('Forge assistant assets are ready.');
  });

  it('returns a fallback message when no assistants are selected', () => {
    const output = buildSuccessMessage([], ['core']);
    expect(output).toBe('Forge assistant assets are ready.');
  });
});
