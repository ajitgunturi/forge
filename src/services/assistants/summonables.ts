import { ForgePlugin } from '../../contracts/forge-plugin.js';

export type PluginGroup = 'core' | 'elevate';

export const PLUGIN_GROUPS: readonly PluginGroup[] = ['core', 'elevate'] as const;

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

export const forgePRCommentsAnalyzerEntry: ForgePlugin = {
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

export const forgeCommitCraftCoachEntry: ForgePlugin = {
  id: 'forge-commit-craft-coach',
  displayName: 'Forge Commit Craft Coach',
  purpose: 'Analyze commit history patterns and coach developers toward atomic, well-narrated commits.',
  instructions: [
    'Use this agent for commit quality coaching, pattern analysis, convention detection, and improvement suggestions.',
    'If the user asks about GitHub Pull Requests, Issues, or Discussions, explain that this coach only covers commit history and stop.',
    'Use read-only `git log`, `git diff --stat`, and `git log --oneline --graph` commands as the primary data path.',
    'Auto-detect whether the repo uses Conventional Commits, scope prefixes, or ticket references — coach toward the repo\'s own standard, not a hardcoded one.',
    'Allow all tool executions (Bash, Read, python3, node, and `git` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This coach is strictly read-only. Never create commits, amend history, rebase, or mutate any Git state.',
    'Do not modify `.gitconfig`, `.git/hooks`, or any repository configuration on the user\'s behalf.',
    'Run the read-only Git CLI flow directly instead of delegating to unrelated skills or helpers.',
    'Suggest narrowing by author, date range, branch, or path when the user needs a smaller slice.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Commit Quality Coaching',
      description: 'Analyzes commit messages, sizes, and patterns to coach developers toward better commit hygiene.',
      benefits: ['Message quality scoring', 'Atomic commit guidance', 'Convention detection and alignment'],
    },
    {
      name: 'Pattern Detection',
      description: 'Identifies commit anti-patterns like end-of-day dumps, bundled changes, and vague messages.',
      benefits: ['Frequency analysis', 'Logical grouping feedback', 'Trend identification'],
    },
  ],
  commands: [
    {
      name: '/agent forge-commit-craft-coach',
      description: 'Select the commit craft coach agent, then ask about commit quality.',
      usage: 'git log --format="%H|%an|%ae|%at|%s" --since="2 weeks ago"',
      examples: [
        '/agent -> select forge-commit-craft-coach -> "review my last 10 commits and coach me on quality"',
        'git log --oneline --graph --since="1 week ago"',
        'git diff --stat HEAD~5..HEAD',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use git as the operational data path.',
    'Ground analysis in freshly fetched git history, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Coach toward the repo\'s detected conventions rather than imposing external standards.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'commit-craft',
  },
};

export const forgePRArchitectEntry: ForgePlugin = {
  id: 'forge-pr-architect',
  displayName: 'Forge PR Architect',
  purpose: 'Analyze PR structure and coach developers toward PRs that reviewers can confidently approve.',
  instructions: [
    'Use this agent for PR structure coaching, size analysis, description quality feedback, and review turnaround insights.',
    'If the user asks about GitHub Issues or Discussions, explain that this coach only covers Pull Request structure and stop.',
    'Use read-only `gh pr list --json` and `gh pr view --json` commands as the primary data path.',
    'Use `gh api repos/{owner}/{repo}/pulls/<n>/reviews` for review turnaround data when needed.',
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This coach is strictly read-only. Never create, update, close, merge, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    'Run the read-only GitHub CLI flow directly instead of delegating to unrelated skills or helpers.',
    'Suggest narrowing by author, state, date range, or label when the user needs a smaller slice.',
    'When no PR number is provided, detect the PR from the current branch automatically with `gh pr view`.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'PR Structure Coaching',
      description: 'Analyzes PR size, file spread, description quality, and commit count to coach toward reviewable PRs.',
      benefits: ['Size coaching toward 100-200 line sweet spot', 'Description quality feedback', 'File spread analysis'],
    },
    {
      name: 'Review Turnaround Insights',
      description: 'Surfaces how long PRs sit in review and correlates size with review speed.',
      benefits: ['Self-benchmarking against repo averages', 'PR stacking guidance', 'Review speed correlation'],
    },
  ],
  commands: [
    {
      name: '/agent forge-pr-architect',
      description: 'Select the PR architect agent, then ask about PR structure.',
      usage: 'gh pr list --json number,title,additions,deletions,changedFiles,createdAt,mergedAt,reviewDecision',
      examples: [
        '/agent -> select forge-pr-architect -> "analyze my open PR and suggest how to make it easier to review"',
        'gh pr view 42 --json title,body,additions,deletions,changedFiles,files,reviews,comments',
        'gh pr view --json title,additions,deletions,changedFiles,commits',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use gh as the operational data path.',
    'Ground analysis in freshly fetched GitHub data, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Coach toward reviewable PR sizes and clear descriptions with data-driven benchmarks.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'pr-architecture',
  },
};

export const forgeReviewQualityCoachEntry: ForgePlugin = {
  id: 'forge-review-quality-coach',
  displayName: 'Forge Review Quality Coach',
  purpose: 'Analyze outgoing code reviews and coach developers toward reviews that are specific, actionable, and architecturally deep.',
  instructions: [
    'Use this agent for review quality coaching, comment depth analysis, actionability scoring, and review coverage insights.',
    'If the user asks about GitHub Issues or Discussions, explain that this coach only covers code review quality and stop.',
    'Use read-only `gh api repos/{owner}/{repo}/pulls?state=all` to list PRs and `gh api repos/{owner}/{repo}/pulls/<n>/comments` to fetch review comments.',
    'Use `gh api repos/{owner}/{repo}/pulls/<n>/reviews` to fetch review verdicts.',
    'Auto-detect the reviewer username from `gh api user` when not explicitly provided.',
    'Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    'This coach is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    'Run the read-only GitHub CLI flow directly instead of delegating to unrelated skills or helpers.',
    'Suggest narrowing by reviewer username, date range, or PR author when the user needs a smaller slice.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Review Depth Analysis',
      description: 'Classifies review comments as surface-level, logic, or architectural and coaches toward deeper reviews.',
      benefits: ['Depth spectrum classification', 'Actionability scoring', 'Pattern detection across reviews'],
    },
    {
      name: 'Review Coverage Insights',
      description: 'Analyzes review participation, latency, and coverage across the repository.',
      benefits: ['Review radius expansion coaching', 'Latency awareness', 'Tone and constructiveness feedback'],
    },
  ],
  commands: [
    {
      name: '/agent forge-review-quality-coach',
      description: 'Select the review quality coach agent, then ask about review quality.',
      usage: 'gh api repos/{owner}/{repo}/pulls?state=all&per_page=100',
      examples: [
        '/agent -> select forge-review-quality-coach -> "analyze my code reviews from the last month"',
        'gh api repos/{owner}/{repo}/pulls/42/comments',
        'gh api repos/{owner}/{repo}/pulls/42/reviews',
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and use gh as the operational data path.',
    'Ground analysis in freshly fetched GitHub data, not guessed repository state.',
    'Allow all read-only tool executions in the analysis pipeline without repeated approval prompts.',
    'Coach toward specific, actionable, architecturally deep reviews with the what + why + suggestion pattern.',
    'Prefer the matching Forge agent or skill over unrelated skill delegation.',
  ],
  metadata: {
    analyzerDomain: 'review-quality',
  },
};

export const forgeCorePlugins: ForgePlugin[] = [
  forgeDiscussionAnalyzerEntry,
  forgeIssueAnalyzerEntry,
  forgePRCommentsAnalyzerEntry,
];

export const forgeElevatePlugins: ForgePlugin[] = [
  forgeCommitCraftCoachEntry,
  forgePRArchitectEntry,
  forgeReviewQualityCoachEntry,
];

export const forgePlugins: ForgePlugin[] = [
  ...forgeCorePlugins,
  ...forgeElevatePlugins,
];

export function resolvePluginGroups(groups: PluginGroup[]): ForgePlugin[] {
  const plugins: ForgePlugin[] = [];
  if (groups.includes('core')) {
    plugins.push(...forgeCorePlugins);
  }
  if (groups.includes('elevate')) {
    plugins.push(...forgeElevatePlugins);
  }
  return plugins;
}
