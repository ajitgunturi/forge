import { ForgePlugin } from '../../contracts/forge-plugin.js';

export const forgeDiscussionAnalyzerEntry: ForgePlugin = {
  id: 'forge-discussion-analyzer',
  displayName: 'Forge Discussion Analyzer',
  purpose: 'Analyze GitHub Discussions for the current repository using read-only gh CLI live fetches.',
  instructions: [
    'Use this agent for discussion digests, triage, pattern analysis, and follow-up answers.',
    'If the user asks about GitHub Issues, redirect them to GitHub Discussions instead of pretending this analyzer covers issues.',
    'Use read-only `gh api graphql` queries as the primary data path for GitHub Discussions.',
    'Derive the current repository owner/name before building a GraphQL query.',
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    'Run the read-only GitHub CLI flow directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-discussion-analyzer` skill for the same discussion workflow.',
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
      description: 'Uses live GitHub discussion fetches through read-only GraphQL requests in the current repository.',
      benefits: ['Lower prompt overhead', 'Fresh answers from live repository data'],
    },
  ],
  commands: [
    {
      name: '/agent forge-discussion-analyzer',
      description: 'Select the discussion analyzer agent, then ask a question.',
      usage: 'gh api graphql -f query="<discussion query>" -F owner="<owner>" -F name="<repo>"',
      examples: [
        '/agent -> select forge-discussion-analyzer -> "what were the major support themes last week?"',
        'gh api graphql -f query="<discussion query>" -F owner="<owner>" -F name="<repo>"',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use gh as the operational data path.',
    'Ground analysis in freshly fetched GitHub data, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal GitHub Discussion summaries and follow-up answers.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'discussions',
  },
};

export const forgeIssueAnalyzerEntry: ForgePlugin = {
  id: 'forge-issue-analyzer',
  displayName: 'Forge Issue Analyzer',
  purpose: 'Analyze GitHub Issues for the current repository using read-only gh CLI live fetches.',
  instructions: [
    'Use this agent for issue digests, triage, pattern analysis, and follow-up answers.',
    'If the user asks about GitHub Discussions, redirect them to GitHub Issues instead of pretending this analyzer covers discussions.',
    'Use read-only `gh issue list` and `gh issue view --json` commands as the primary data path.',
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    'Run the read-only GitHub CLI flow directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-issue-analyzer` skill for the same issue workflow.',
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
      description: 'Uses live GitHub issue fetches through read-only gh CLI commands in the current repository.',
      benefits: ['Lower prompt overhead', 'Fresh answers from live repository data'],
    },
  ],
  commands: [
    {
      name: '/agent forge-issue-analyzer',
      description: 'Select the issue analyzer agent, then ask a question.',
      usage: 'gh issue list --limit 100 --state open --json number,title,labels,createdAt,updatedAt',
      examples: [
        '/agent -> select forge-issue-analyzer -> "what were the major open bug patterns last week?"',
        'gh issue view 123 --json number,title,labels,state,createdAt,updatedAt,body',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use gh as the operational data path.',
    'Ground analysis in freshly fetched GitHub data, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal GitHub Issue summaries and follow-up answers.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'issues',
  },
};

export const forgePRReviewAnalyzerEntry: ForgePlugin = {
  id: 'forge-pr-comments-analyzer',
  displayName: 'Forge PR Comments Analyzer',
  purpose: 'Analyze GitHub Pull Request review comments for the current repository using read-only gh CLI live fetches.',
  instructions: [
    'Use this agent for PR review comment analysis, triage, pattern detection, and surgical fix suggestions.',
    'If the user asks about GitHub Issues or Discussions, redirect them to Pull Request reviews instead of pretending this analyzer covers those.',
    'Use read-only `gh pr view` and `gh pr list --json` commands as the primary data path.',
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    'Run the read-only GitHub CLI flow directly instead of delegating to unrelated skills or helpers.',
    'If GitHub Copilot chooses to use a skill for this task, use only the `forge-pr-comments-analyzer` skill for the same PR review workflow.',
    'Suggest narrowing by reviewer username, relative windows, or explicit after/before dates when the user needs a smaller slice.',
    'When no PR number is provided, detect the PR from the current branch automatically with `gh pr view`.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'PR Review Digests',
      description: 'Produces structured summaries and analysis from GitHub Pull Request review comments.',
      benefits: ['Scannable comment summaries', 'Severity and category classification', 'Surgical fix suggestions'],
    },
    {
      name: 'Compact Context',
      description: 'Uses live GitHub pull request review fetches through read-only gh CLI commands in the current repository.',
      benefits: ['Lower prompt overhead', 'Fresh answers from live repository data'],
    },
  ],
  commands: [
    {
      name: '/agent forge-pr-comments-analyzer',
      description: 'Select the PR comments analyzer agent, then ask a question.',
      usage: 'gh pr view --json number,title,reviewDecision,reviews,comments',
      examples: [
        '/agent -> select forge-pr-comments-analyzer -> "analyze review comments on #42"',
        'gh pr view 42 --json number,title,reviewDecision,reviews,comments',
        'gh pr view --json number,title,reviewDecision,reviews,comments',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use gh as the operational data path.',
    'Ground analysis in freshly fetched GitHub data, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Optimize for high-signal PR review comment summaries and actionable surgical fix suggestions.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
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
