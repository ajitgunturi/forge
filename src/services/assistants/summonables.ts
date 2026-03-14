import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { COPILOT_RUNTIME_ENTRY } from './copilot.js';

export const forgeDiscussionAnalyzerEntry: ForgePlugin = {
  id: 'forge-discussion-analyzer',
  displayName: 'Forge Discussion Analyzer',
  purpose: 'Analyze GitHub Discussions for the current repository through Forge-managed live fetching and summary artifacts.',
  instructions: [
    'Use this agent for discussion digests, triage, pattern analysis, and follow-up answers.',
    'If the user asks about GitHub Issues, redirect them to GitHub Discussions instead of pretending this analyzer covers issues.',
    `Treat \`${COPILOT_RUNTIME_ENTRY}\` as the only backend for this workflow.`,
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not run npm install or repair Forge dependencies.',
    'If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh discussion list`, `gh discussion view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
    'Run the Forge command directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-discussion-analyzer` skill that points back to the same Forge command.',
    'Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    'Suggest narrowing by category, relative windows, or explicit after/before dates when the user needs a smaller slice.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Discussion Digests',
      description: 'Produces structured summaries and analysis from GitHub Discussions.',
      benefits: ['Scannable summaries', 'Question-driven follow-up analysis'],
    },
    {
      name: 'Compact Context',
      description: 'Uses live GitHub discussion fetches and saves only summary artifacts to .forge.',
      benefits: ['Lower prompt overhead', 'No durable semantic drift from cached analysis state'],
    },
  ],
  commands: [
    {
      name: '/agent forge-discussion-analyzer',
      description: 'Select the discussion analyzer agent, then ask a question.',
      usage: `${COPILOT_RUNTIME_ENTRY} --run forge-discussion-analyzer --question "<your question>"`,
      examples: [
        '/agent -> select forge-discussion-analyzer -> "what were the major support themes last week?"',
        `${COPILOT_RUNTIME_ENTRY} --run forge-discussion-analyzer --question "summarize unresolved discussions"`,
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and let Forge own the operational backend.',
    'Ground analysis in fetched sidecar artifacts, not in guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal GitHub Discussion summaries and follow-up answers.',
    'Prefer the Forge-managed agent or the matching Forge skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'discussions',
  },
};

export const forgeIssueAnalyzerEntry: ForgePlugin = {
  id: 'forge-issue-analyzer',
  displayName: 'Forge Issue Analyzer',
  purpose: 'Analyze GitHub Issues for the current repository through Forge-managed live fetching and summary artifacts.',
  instructions: [
    'Use this agent for issue digests, triage, pattern analysis, and follow-up answers.',
    'If the user asks about GitHub Discussions, redirect them to GitHub Issues instead of pretending this analyzer covers discussions.',
    `Treat \`${COPILOT_RUNTIME_ENTRY}\` as the only backend for this workflow.`,
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not run npm install or repair Forge dependencies.',
    'If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
    'Run the Forge command directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-issue-analyzer` skill that points back to the same Forge command.',
    'Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    'Suggest narrowing by label, state, relative windows, or explicit after/before dates when the user needs a smaller slice.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Issue Digests',
      description: 'Produces structured summaries and analysis from GitHub Issues.',
      benefits: ['Scannable summaries', 'Question-driven follow-up analysis'],
    },
    {
      name: 'Compact Context',
      description: 'Uses live GitHub issue fetches and saves only summary artifacts to .forge.',
      benefits: ['Lower prompt overhead', 'No durable semantic drift from cached analysis state'],
    },
  ],
  commands: [
    {
      name: '/agent forge-issue-analyzer',
      description: 'Select the issue analyzer agent, then ask a question.',
      usage: `${COPILOT_RUNTIME_ENTRY} --run forge-issue-analyzer --question "<your question>"`,
      examples: [
        '/agent -> select forge-issue-analyzer -> "what were the major open bug patterns last week?"',
        `${COPILOT_RUNTIME_ENTRY} --run forge-issue-analyzer --question "summarize blocked issues"`,
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and let Forge own the operational backend.',
    'Ground analysis in fetched sidecar artifacts, not in guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal GitHub Issue summaries and follow-up answers.',
    'Prefer the Forge-managed agent or the matching Forge skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'issues',
  },
};

export const forgePRReviewAnalyzerEntry: ForgePlugin = {
  id: 'forge-pr-comments-analyzer',
  displayName: 'Forge PR Comments Analyzer',
  purpose: 'Analyze GitHub Pull Request review comments for the current repository through Forge-managed live fetching and summary artifacts.',
  instructions: [
    'Use this agent for PR review comment analysis, triage, pattern detection, and surgical fix suggestions.',
    'If the user asks about GitHub Issues or Discussions, redirect them to Pull Request reviews instead of pretending this analyzer covers those.',
    `Treat \`${COPILOT_RUNTIME_ENTRY}\` as the only backend for this workflow.`,
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not run npm install or repair Forge dependencies.',
    'If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh pr view`, `gh pr diff`, `gh api`) to fetch the data. Never run mutation commands such as `gh pr close`, `gh pr merge`, `gh pr comment`, `gh pr review`, or `gh api` with write methods.',
    'Run the Forge command directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-pr-comments-analyzer` skill that points back to the same Forge command.',
    'Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    'Suggest narrowing by reviewer username, relative windows, or explicit after/before dates when the user needs a smaller slice.',
    'When no --pr number is provided, detect the PR from the current branch automatically.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'PR Review Digests',
      description: 'Produces structured summaries and analysis from GitHub Pull Request review comments.',
      benefits: ['Scannable comment summaries', 'Severity and category classification', 'Surgical fix suggestions'],
    },
    {
      name: 'Compact Context',
      description: 'Uses live GitHub PR fetches and saves only summary artifacts to .forge.',
      benefits: ['Lower prompt overhead', 'No durable semantic drift from cached analysis state'],
    },
  ],
  commands: [
    {
      name: '/agent forge-pr-comments-analyzer',
      description: 'Select the PR comments analyzer agent, then ask a question.',
      usage: `${COPILOT_RUNTIME_ENTRY} --run forge-pr-comments-analyzer --question "<your question>"`,
      examples: [
        '/agent -> select forge-pr-comments-analyzer -> "analyze review comments on #42"',
        `${COPILOT_RUNTIME_ENTRY} --run forge-pr-comments-analyzer --pr 42 --question "suggest fixes for all critical comments"`,
        `${COPILOT_RUNTIME_ENTRY} --run forge-pr-comments-analyzer --reviewer octocat --question "summarize feedback from octocat"`,
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and let Forge own the operational backend.',
    'Ground analysis in fetched sidecar artifacts, not in guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal PR review comment summaries and actionable surgical fix suggestions.',
    'Prefer the Forge-managed agent or the matching Forge skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'pr-reviews',
  },
};

export const forgePlugins: ForgePlugin[] = [
  forgeDiscussionAnalyzerEntry,
  forgeIssueAnalyzerEntry,
  forgePRReviewAnalyzerEntry,
];
