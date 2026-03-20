import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { FORGE_MANAGED_END, FORGE_MANAGED_START, FORGE_USER_END, FORGE_USER_START } from './copilot.js';
import { getExposedPluginName, getPluginRoute } from './exposure.js';

type AnalyzerDomain = 'discussions' | 'issues' | 'pr-reviews';

interface AnalyzerPromptContext {
  analyzerDescription: string;
  workflowTitle: string;
  roleName: string;
  subjectPlural: string;
  subjectSingularLower: string;
  counterpartPlural: string;
  narrowingHint: string;
}

interface AnalyzerExecutionGuidance {
  agentInstructions: string[];
  workflowRules: string[];
  geminiPromptLine: string;
}

function getAnalyzerDomain(entry: ForgePlugin): AnalyzerDomain {
  if (entry.metadata && typeof entry.metadata === 'object' && entry.metadata.analyzerDomain === 'issues') {
    return 'issues';
  }
  if (entry.metadata && typeof entry.metadata === 'object' && entry.metadata.analyzerDomain === 'pr-reviews') {
    return 'pr-reviews';
  }
  return 'discussions';
}

function getAnalyzerPromptContext(entry: ForgePlugin): AnalyzerPromptContext {
  const domain = getAnalyzerDomain(entry);
  if (domain === 'issues') {
    return {
      analyzerDescription: 'Analyze GitHub Issues for the current repository using read-only gh CLI live fetches.',
      workflowTitle: 'Issue Analyzer Workflow',
      roleName: 'Forge Issue Analyzer',
      subjectPlural: 'GitHub Issues',
      subjectSingularLower: 'issue',
      counterpartPlural: 'GitHub Discussions',
      narrowingHint: 'label, state, relative windows, or explicit after/before dates',
    };
  }

  if (domain === 'pr-reviews') {
    return {
      analyzerDescription: 'Analyze GitHub Pull Request review comments for the current repository using read-only gh CLI live fetches.',
      workflowTitle: 'PR Comments Analyzer Workflow',
      roleName: 'Forge PR Comments Analyzer',
      subjectPlural: 'GitHub Pull Request Reviews',
      subjectSingularLower: 'pull request review',
      counterpartPlural: 'GitHub Issues and Discussions',
      narrowingHint: 'PR number, reviewer username, relative windows, or explicit after/before dates',
    };
  }

  return {
    analyzerDescription: 'Analyze GitHub Discussions for the current repository using read-only gh CLI live fetches.',
    workflowTitle: 'Discussion Analyzer Workflow',
    roleName: 'Forge Discussion Analyzer',
    subjectPlural: 'GitHub Discussions',
    subjectSingularLower: 'discussion',
    counterpartPlural: 'GitHub Issues',
    narrowingHint: 'category, relative windows, or explicit after/before dates',
  };
}

function getAnalyzerExecutionGuidance(entry: ForgePlugin): AnalyzerExecutionGuidance {
  const domain = getAnalyzerDomain(entry);

  if (domain === 'issues') {
    return {
      agentInstructions: [
        'Use read-only `gh issue list` and `gh issue view --json` commands as the primary data path.',
        'Apply state, label, relative windows, or explicit after/before dates with `gh issue` flags, search qualifiers, and local filtering.',
        'Capture the issue numbers, labels, states, timestamps, and body excerpts needed to answer the question.',
      ],
      workflowRules: [
        '- Primary data path: `gh issue list` and `gh issue view --json`.',
        '- Narrow with `--state`, label filters, search qualifiers, or local date filtering as needed.',
        '- Ground the answer in issue numbers, labels, states, timestamps, and linked pull request context when relevant.',
      ],
      geminiPromptLine: 'Primary data path: read-only `gh issue list` and `gh issue view --json` commands run from the current repository.',
    };
  }

  if (domain === 'pr-reviews') {
    return {
      agentInstructions: [
        'Use read-only `gh pr view` and `gh pr list --json` commands as the primary data path for pull request review work.',
        'When no PR number is provided, detect the current pull request from the checked-out branch with `gh pr view`.',
        'If inline review comments are missing from `gh pr view --json`, use read-only `gh api repos/{owner}/{repo}/pulls/<pr>/comments` to fetch them.',
      ],
      workflowRules: [
        '- Primary data path: `gh pr view` and `gh pr list --json`.',
        '- When the request omits a PR number, resolve the current branch PR before analyzing feedback.',
        '- Use read-only `gh api repos/{owner}/{repo}/pulls/<pr>/comments` only when you need inline review comments that `gh pr view --json` did not expose.',
      ],
      geminiPromptLine: 'Primary data path: read-only `gh pr view` / `gh pr list --json`, with current-branch PR detection when no PR number is provided.',
    };
  }

  return {
    agentInstructions: [
      'Use read-only `gh api graphql` queries as the primary data path for GitHub Discussions.',
      'Derive the current repository owner/name from the checked-out repository before building the GraphQL query.',
      'Fetch the discussion number, title, category, answer state, timestamps, and relevant comments needed to answer the question.',
    ],
    workflowRules: [
      '- Primary data path: read-only `gh api graphql` queries against the current repository.',
      '- Resolve the current repository owner/name before issuing the GraphQL request.',
      '- Shape the GraphQL selection set around categories, answer state, timestamps, and comments, then narrow by category or date window as needed.',
    ],
    geminiPromptLine: 'Primary data path: read-only `gh api graphql` queries that fetch discussion metadata and comments from the current repository.',
  };
}

export function sanitizePlainScalar(value: string): string {
  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/:\s/g, ' - ')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

export function getWorkflowFileName(entry: ForgePlugin): string {
  return `${getPluginRoute(entry.id).localName}.md`;
}

export function getCommandFileName(entry: ForgePlugin, extension: 'md' | 'toml'): string {
  return `${getPluginRoute(entry.id).localName}.${extension}`;
}

export function getCommandDirectoryName(entry: ForgePlugin): string {
  return getPluginRoute(entry.id).namespace ?? 'forge';
}

function renderManagedMarkdown(
  frontmatterLines: string[],
  managedBody: string,
  userPlaceholderLines?: string[],
): string {
  const lines = [
    '---',
    ...frontmatterLines,
    '---',
    '',
    FORGE_MANAGED_START,
    managedBody.trim(),
    FORGE_MANAGED_END,
  ];

  if (!userPlaceholderLines || userPlaceholderLines.length === 0) {
    return `${lines.join('\n')}\n`;
  }

  return [
    ...lines,
    '',
    FORGE_USER_START,
    ...userPlaceholderLines,
    FORGE_USER_END,
    '',
  ].join('\n');
}

function renderAnalyzerAgentPrompt(entry: ForgePlugin): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);

  return [
    '<role>',
    `You are the ${context.roleName}.`,
    `Analyze ${context.subjectPlural} for the current repository using read-only GitHub CLI commands.`,
    '</role>',
    '',
    '<instructions>',
    `- Use this agent for ${context.subjectSingularLower} digests, triage, pattern analysis, and follow-up answers.`,
    `- If the user asks about ${context.counterpartPlural}, explain that this analyzer only covers ${context.subjectPlural} and stop.`,
    ...guidance.agentInstructions.map((line) => `- ${line}`),
    `- Every answer must use a fresh live fetch; never answer from stale local notes or cached ${context.subjectSingularLower} summaries alone.`,
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    '- Summarize the filters and time window you used whenever they materially affect the answer.',
    `- Suggest narrowing by ${context.narrowingHint} when the user needs a smaller slice.`,
    '</instructions>',
  ].join('\n');
}

export function renderClaudeCommand(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);
  const commandName = sanitizePlainScalar(getExposedPluginName('claude', 'command', entry));
  const workflowReference = `@${workflowPath}`;
  const body = [
    '<objective>',
    context.analyzerDescription,
    '</objective>',
    '',
    '<execution_context>',
    workflowReference,
    '</execution_context>',
    '',
    '<context>',
    '$ARGUMENTS',
    '',
    `Ask a concrete question about ${context.subjectPlural} for the current repository.`,
    '</context>',
    '',
    '<process>',
    `Execute the workflow from ${workflowReference} end-to-end.`,
    ...guidance.workflowRules,
    'Preserve the live-fetch-only behavior for every query.',
    `If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that limitation and stop.`,
    '</process>',
  ].join('\n');

  return renderManagedMarkdown(
    [
      `name: ${commandName}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'argument-hint: "<question>"',
      'allowed-tools:',
      '  - Read',
      '  - Bash',
    ],
    body,
    [
      '<!-- Add team- or user-specific Claude command instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderClaudeAgent(entry: ForgePlugin): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedPluginName('claude', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools: Bash, Read',
    ],
    renderAnalyzerAgentPrompt(entry),
    [
      '<!-- Add team- or user-specific Claude agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderClaudeWorkflow(entry: ForgePlugin): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);

  return [
    `# ${context.workflowTitle}`,
    '',
    'Use read-only GitHub CLI commands directly in the current repository for this workflow.',
    '',
    'Execution rules:',
    ...guidance.workflowRules,
    `- Every query must use a fresh live fetch; do not answer from stale local ${context.subjectSingularLower} notes alone.`,
    `- If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that this workflow only covers ${context.subjectPlural} and stop.`,
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This workflow is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    `- Suggest narrowing by ${context.narrowingHint} when the user needs a smaller slice.`,
  ].join('\n');
}

export function renderCodexSkill(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);
  const skillName = sanitizePlainScalar(getExposedPluginName('codex', 'skill', entry));
  const workflowReference = `@${workflowPath}`;
  const body = [
    '<codex_skill_adapter>',
    '## Skill Invocation',
    `- This skill is invoked by mentioning \`$${skillName}\`.`,
    `- Treat all user text after the skill mention as the ${context.subjectSingularLower} question.`,
    `- If no question is provided, ask the user what they want to know about the repository ${context.subjectPlural}.`,
    '</codex_skill_adapter>',
    '',
    '<objective>',
    context.analyzerDescription,
    '</objective>',
    '',
    '<execution_context>',
    workflowReference,
    '</execution_context>',
    '',
    '<context>',
    '{{QUESTION}}',
    '</context>',
    '',
    '<process>',
    `Execute the workflow from ${workflowReference} end-to-end.`,
    ...guidance.workflowRules,
    'Preserve the live-fetch-only behavior for every query.',
    `If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that limitation and stop.`,
    '</process>',
  ].join('\n');

  return renderManagedMarkdown(
    [
      `name: "${skillName}"`,
      `description: "${sanitizePlainScalar(entry.purpose)}"`,
      'metadata:',
      `  short-description: "${sanitizePlainScalar(entry.purpose)}"`,
    ],
    body,
    [
      '<!-- Add team- or user-specific Codex skill instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderCodexAgent(entry: ForgePlugin): string {
  const body = renderAnalyzerAgentPrompt(entry);
  return renderManagedMarkdown(
    [
      `name: "${sanitizePlainScalar(getExposedPluginName('codex', 'agent', entry))}"`,
      `description: "${sanitizePlainScalar(entry.purpose)}"`,
    ],
    [
      '<codex_agent_role>',
      `role: ${sanitizePlainScalar(getExposedPluginName('codex', 'agent', entry))}`,
      'tools: Read, Bash',
      `purpose: ${sanitizePlainScalar(entry.purpose)}`,
      '</codex_agent_role>',
      '',
      body,
    ].join('\n'),
  );
}

export function renderCodexAgentToml(entry: ForgePlugin): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);
  const body = [
    '<role>',
    `You are the ${context.roleName}.`,
    `Analyze ${context.subjectPlural} for the current repository using read-only GitHub CLI commands.`,
    '</role>',
    '',
    '<instructions>',
    `- Use this agent for ${context.subjectSingularLower} digests, triage, pattern analysis, and follow-up answers.`,
    `- If the user asks about ${context.counterpartPlural}, explain that this analyzer only covers ${context.subjectPlural} and stop.`,
    ...guidance.agentInstructions.map((line) => `- ${line}`),
    '- Every query must use a fresh live fetch; never answer from stale local notes or cached summaries alone.',
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    '</instructions>',
  ].join('\n');

  return [
    'sandbox_mode = "workspace-write"',
    `developer_instructions = """\n${body}\n"""`,
    '',
  ].join('\n');
}

export function renderCodexWorkflow(entry: ForgePlugin): string {
  return renderClaudeWorkflow(entry);
}

export function renderGeminiCommand(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
  const guidance = getAnalyzerExecutionGuidance(entry);
  const prompt = [
    '<objective>',
    context.analyzerDescription,
    '</objective>',
    '',
    '<context>',
    'User question: $ARGUMENTS',
    '',
    'Run in the current repository.',
    '</context>',
    '',
    '<process>',
    `Reference workflow: @${workflowPath}`,
    `If $ARGUMENTS is empty or still appears as the literal placeholder "$ARGUMENTS", ask the user for a concrete ${context.subjectPlural} question and stop.`,
    guidance.geminiPromptLine,
    'Run the read-only GitHub CLI flow directly from the current repository once you have a concrete question.',
    'Allow all tool executions (shell commands, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts.',
    'Preserve the live-fetch-only behavior for every query.',
    `If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that limitation and stop.`,
    'This workflow is strictly read-only — never create, update, close, comment on, or mutate any GitHub resource.',
    'Do not install `gh` extensions, edit `~/.config/gh`, or run authentication setup flows on the user\'s behalf.',
    '</process>',
  ].join('\n');

  return [
    `description = ${JSON.stringify(sanitizePlainScalar(entry.purpose))}`,
    `prompt = ${JSON.stringify(prompt)}`,
    '',
  ].join('\n');
}

export function renderGeminiAgent(entry: ForgePlugin): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedPluginName('gemini', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools:',
      '  - read_file',
      '  - run_shell_command',
    ],
    renderAnalyzerAgentPrompt(entry),
    [
      '<!-- Add team- or user-specific Gemini agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderGeminiWorkflow(entry: ForgePlugin): string {
  return renderClaudeWorkflow(entry);
}
