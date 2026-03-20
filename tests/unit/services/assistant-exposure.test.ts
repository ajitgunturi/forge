import { describe, expect, it } from 'vitest';
import {
  forgeDiscussionAnalyzerEntry,
  forgeIssueAnalyzerEntry,
  forgePRCommentsAnalyzerEntry,
  forgeCommitCraftCoachEntry,
  forgePRArchitectEntry,
  forgeReviewQualityCoachEntry,
} from '../../../src/services/assistants/summonables.js';
import { getExposedPluginName, getPluginRoute, toNamespacedPluginName } from '../../../src/services/assistants/exposure.js';

describe('assistant exposure naming', () => {
  it('keeps the runtime id stable while command runtimes use the namespaced command alias', () => {
    expect(forgeDiscussionAnalyzerEntry.id).toBe('forge-discussion-analyzer');
    expect(forgeIssueAnalyzerEntry.id).toBe('forge-issue-analyzer');
    expect(forgePRCommentsAnalyzerEntry.id).toBe('forge-pr-comments-analyzer');
    expect(forgeCommitCraftCoachEntry.id).toBe('forge-commit-craft-coach');
    expect(forgePRArchitectEntry.id).toBe('forge-pr-architect');
    expect(forgeReviewQualityCoachEntry.id).toBe('forge-review-quality-coach');
    expect(getExposedPluginName('claude', 'command', forgeDiscussionAnalyzerEntry)).toBe('forge:discussion-analyzer');
    expect(getExposedPluginName('gemini', 'command', forgeDiscussionAnalyzerEntry)).toBe('forge:discussion-analyzer');
    expect(getExposedPluginName('claude', 'command', forgeIssueAnalyzerEntry)).toBe('forge:issue-analyzer');
    expect(getExposedPluginName('gemini', 'command', forgeIssueAnalyzerEntry)).toBe('forge:issue-analyzer');
    expect(getExposedPluginName('claude', 'command', forgePRCommentsAnalyzerEntry)).toBe('forge:pr-comments-analyzer');
    expect(getExposedPluginName('gemini', 'command', forgePRCommentsAnalyzerEntry)).toBe('forge:pr-comments-analyzer');
    expect(getExposedPluginName('claude', 'command', forgeCommitCraftCoachEntry)).toBe('forge:commit-craft-coach');
    expect(getExposedPluginName('gemini', 'command', forgeCommitCraftCoachEntry)).toBe('forge:commit-craft-coach');
    expect(getExposedPluginName('claude', 'command', forgePRArchitectEntry)).toBe('forge:pr-architect');
    expect(getExposedPluginName('gemini', 'command', forgePRArchitectEntry)).toBe('forge:pr-architect');
    expect(getExposedPluginName('claude', 'command', forgeReviewQualityCoachEntry)).toBe('forge:review-quality-coach');
    expect(getExposedPluginName('gemini', 'command', forgeReviewQualityCoachEntry)).toBe('forge:review-quality-coach');
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
    expect(getExposedPluginName('copilot', 'agent', forgePRCommentsAnalyzerEntry)).toBe('forge-pr-comments-analyzer');
    expect(getExposedPluginName('codex', 'skill', forgePRCommentsAnalyzerEntry)).toBe('forge-pr-comments-analyzer');
    expect(getExposedPluginName('claude', 'agent', forgePRCommentsAnalyzerEntry)).toBe('forge-pr-comments-analyzer');
    expect(getExposedPluginName('copilot', 'agent', forgeCommitCraftCoachEntry)).toBe('forge-commit-craft-coach');
    expect(getExposedPluginName('codex', 'skill', forgeCommitCraftCoachEntry)).toBe('forge-commit-craft-coach');
    expect(getExposedPluginName('claude', 'agent', forgeCommitCraftCoachEntry)).toBe('forge-commit-craft-coach');
    expect(getExposedPluginName('copilot', 'agent', forgePRArchitectEntry)).toBe('forge-pr-architect');
    expect(getExposedPluginName('codex', 'skill', forgePRArchitectEntry)).toBe('forge-pr-architect');
    expect(getExposedPluginName('claude', 'agent', forgePRArchitectEntry)).toBe('forge-pr-architect');
    expect(getExposedPluginName('copilot', 'agent', forgeReviewQualityCoachEntry)).toBe('forge-review-quality-coach');
    expect(getExposedPluginName('codex', 'skill', forgeReviewQualityCoachEntry)).toBe('forge-review-quality-coach');
    expect(getExposedPluginName('claude', 'agent', forgeReviewQualityCoachEntry)).toBe('forge-review-quality-coach');
  });

  it('derives the command path route and converts only the leading namespace separator', () => {
    expect(toNamespacedPluginName('forge-discussion-analyzer')).toBe('forge:discussion-analyzer');
    expect(toNamespacedPluginName('forge-issue-analyzer')).toBe('forge:issue-analyzer');
    expect(toNamespacedPluginName('forge-pr-comments-analyzer')).toBe('forge:pr-comments-analyzer');
    expect(toNamespacedPluginName('forge-commit-craft-coach')).toBe('forge:commit-craft-coach');
    expect(toNamespacedPluginName('forge-pr-architect')).toBe('forge:pr-architect');
    expect(toNamespacedPluginName('forge-review-quality-coach')).toBe('forge:review-quality-coach');
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
    expect(getPluginRoute('forge-pr-comments-analyzer')).toEqual({
      namespace: 'forge',
      localName: 'pr-comments-analyzer',
      namespacedName: 'forge:pr-comments-analyzer',
    });
    expect(getPluginRoute('forge-commit-craft-coach')).toEqual({
      namespace: 'forge',
      localName: 'commit-craft-coach',
      namespacedName: 'forge:commit-craft-coach',
    });
    expect(getPluginRoute('forge-pr-architect')).toEqual({
      namespace: 'forge',
      localName: 'pr-architect',
      namespacedName: 'forge:pr-architect',
    });
    expect(getPluginRoute('forge-review-quality-coach')).toEqual({
      namespace: 'forge',
      localName: 'review-quality-coach',
      namespacedName: 'forge:review-quality-coach',
    });
  });
});
