import { describe, expect, it } from 'vitest';
import { forgeDiscussionAnalyzerEntry, forgeIssueAnalyzerEntry } from '../../../src/services/assistants/summonables.js';
import { getExposedPluginName, getPluginRoute, toNamespacedPluginName } from '../../../src/services/assistants/exposure.js';

describe('assistant exposure naming', () => {
  it('keeps the runtime id stable while command runtimes use the namespaced command alias', () => {
    expect(forgeDiscussionAnalyzerEntry.id).toBe('forge-discussion-analyzer');
    expect(forgeIssueAnalyzerEntry.id).toBe('forge-issue-analyzer');
    expect(getExposedPluginName('claude', 'command', forgeDiscussionAnalyzerEntry)).toBe('forge:discussion-analyzer');
    expect(getExposedPluginName('gemini', 'command', forgeDiscussionAnalyzerEntry)).toBe('forge:discussion-analyzer');
    expect(getExposedPluginName('claude', 'command', forgeIssueAnalyzerEntry)).toBe('forge:issue-analyzer');
    expect(getExposedPluginName('gemini', 'command', forgeIssueAnalyzerEntry)).toBe('forge:issue-analyzer');
  });

  it('keeps agent and skill ids stable for Copilot, Codex, and Claude agents', () => {
    expect(getExposedPluginName('copilot', 'agent', forgeDiscussionAnalyzerEntry)).toBe('forge-discussion-analyzer');
    expect(getExposedPluginName('copilot', 'skill', forgeDiscussionAnalyzerEntry)).toBe('forge-discussion-analyzer');
    expect(getExposedPluginName('codex', 'skill', forgeDiscussionAnalyzerEntry)).toBe('forge-discussion-analyzer');
    expect(getExposedPluginName('claude', 'agent', forgeDiscussionAnalyzerEntry)).toBe('forge-discussion-analyzer');
    expect(getExposedPluginName('copilot', 'agent', forgeIssueAnalyzerEntry)).toBe('forge-issue-analyzer');
    expect(getExposedPluginName('copilot', 'skill', forgeIssueAnalyzerEntry)).toBe('forge-issue-analyzer');
    expect(getExposedPluginName('codex', 'skill', forgeIssueAnalyzerEntry)).toBe('forge-issue-analyzer');
    expect(getExposedPluginName('claude', 'agent', forgeIssueAnalyzerEntry)).toBe('forge-issue-analyzer');
  });

  it('derives the command path route and converts only the leading namespace separator', () => {
    expect(toNamespacedPluginName('forge-discussion-analyzer')).toBe('forge:discussion-analyzer');
    expect(toNamespacedPluginName('forge-issue-analyzer')).toBe('forge:issue-analyzer');
    expect(toNamespacedPluginName('singleword')).toBe('singleword');
    expect(getPluginRoute('forge-discussion-analyzer')).toEqual({
      namespace: 'forge',
      localName: 'discussion-analyzer',
      namespacedName: 'forge:discussion-analyzer',
    });
    expect(getPluginRoute('forge-issue-analyzer')).toEqual({
      namespace: 'forge',
      localName: 'issue-analyzer',
      namespacedName: 'forge:issue-analyzer',
    });
  });
});
