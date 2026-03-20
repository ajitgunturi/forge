import { describe, expect, it } from 'vitest';
import {
  buildInteractiveOperationLines,
  buildInteractiveInstallSummary,
  renderInteractiveInstallerScreen,
  resolveInteractiveAssistantChoice,
} from '../../../src/commands/install-assistants.js';

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
