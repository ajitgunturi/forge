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
      analyzerDescription: 'Analyze GitHub Issues for the current repository through Forge-managed live fetching and summary artifacts.',
      workflowTitle: 'Forge Issue Analyzer Workflow',
      roleName: 'Forge Issue Analyzer',
      subjectPlural: 'GitHub Issues',
      subjectSingularLower: 'issue',
      counterpartPlural: 'GitHub Discussions',
      narrowingHint: 'label, state, relative windows, or explicit after/before dates',
    };
  }

  if (domain === 'pr-reviews') {
    return {
      analyzerDescription: 'Analyze GitHub Pull Request review comments for the current repository through Forge-managed live fetching and summary artifacts.',
      workflowTitle: 'Forge PR Review Analyzer Workflow',
      roleName: 'Forge PR Review Analyzer',
      subjectPlural: 'GitHub Pull Request Reviews',
      subjectSingularLower: 'pull request review',
      counterpartPlural: 'GitHub Issues and Discussions',
      narrowingHint: 'PR number, reviewer username, relative windows, or explicit after/before dates',
    };
  }

  return {
    analyzerDescription: 'Analyze GitHub Discussions for the current repository through Forge-managed live fetching and summary artifacts.',
    workflowTitle: 'Forge Discussion Analyzer Workflow',
    roleName: 'Forge Discussion Analyzer',
    subjectPlural: 'GitHub Discussions',
    subjectSingularLower: 'discussion',
    counterpartPlural: 'GitHub Issues',
    narrowingHint: 'category, relative windows, or explicit after/before dates',
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

function renderAnalyzerAgentPrompt(entry: ForgePlugin, runtimeEntryCommand: string): string {
  const context = getAnalyzerPromptContext(entry);
  const runCommand = `${runtimeEntryCommand} --run ${entry.id} --question "<question>"`;

  return [
    '<role>',
    `You are the ${context.roleName}.`,
    `Analyze ${context.subjectPlural} for the current repository using Forge as the only backend.`,
    '</role>',
    '',
    '<instructions>',
    `- Use this agent for ${context.subjectSingularLower} digests, triage, pattern analysis, and follow-up answers.`,
    `- If the user asks about ${context.counterpartPlural}, explain that this analyzer only covers ${context.subjectPlural} and stop.`,
    `- Run \`${runCommand}\` directly instead of delegating to unrelated helpers.`,
    `- Every query must use a live fetch through Forge; never answer from local cached ${context.subjectSingularLower} summaries alone.`,
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not run npm install or repair Forge dependencies.',
    '- If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
    '- Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    `- Suggest narrowing by ${context.narrowingHint} when the user needs a smaller slice.`,
    '</instructions>',
  ].join('\n');
}

export function renderClaudeCommand(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
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

export function renderClaudeAgent(entry: ForgePlugin, runtimeEntryCommand: string): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedPluginName('claude', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools: Bash, Read',
    ],
    renderAnalyzerAgentPrompt(entry, runtimeEntryCommand),
    [
      '<!-- Add team- or user-specific Claude agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderClaudeWorkflow(_entry: ForgePlugin, runtimeEntryCommand: string): string {
  const context = getAnalyzerPromptContext(_entry);
  return [
    `# ${context.workflowTitle}`,
    '',
    `Run \`${runtimeEntryCommand} --run ${_entry.id} --question "$ARGUMENTS"\` as the only backend for this workflow.`,
    '',
    'Execution rules:',
    `- Every query must use Forge live fetches; do not answer from local ${context.subjectSingularLower} summary content alone.`,
    `- If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that this workflow only covers ${context.subjectPlural} and stop.`,
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This workflow is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not run npm install or repair Forge dependencies.',
    '- If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
  ].join('\n');
}

export function renderCodexSkill(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
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

export function renderCodexAgent(entry: ForgePlugin, runtimeEntryCommand: string): string {
  const body = renderAnalyzerAgentPrompt(entry, runtimeEntryCommand);
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

export function renderCodexAgentToml(entry: ForgePlugin, runtimeEntryCommand: string): string {
  const context = getAnalyzerPromptContext(entry);
  const runCommand = `${runtimeEntryCommand} --run ${entry.id} --question "<question>"`;
  const body = [
    '<role>',
    `You are the ${context.roleName}.`,
    `Analyze ${context.subjectPlural} for the current repository using Forge as the only backend.`,
    '</role>',
    '',
    '<instructions>',
    `- Use this agent for ${context.subjectSingularLower} digests, triage, pattern analysis, and follow-up answers.`,
    `- If the user asks about ${context.counterpartPlural}, explain that this analyzer only covers ${context.subjectPlural} and stop.`,
    `- Run \`${runCommand}\` directly instead of delegating to unrelated helpers.`,
    '- Every query must use a live fetch through Forge; never answer from local cached summaries alone.',
    '- Allow all tool executions (Bash, Read, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts. Approve the full analysis pipeline up front.',
    '- This analyzer is strictly read-only. Never create, update, close, comment on, or mutate any GitHub resource.',
    '- Do not run npm install or repair Forge dependencies.',
    '- If Forge fails or times out because of network or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
    '</instructions>',
  ].join('\n');

  return [
    'sandbox_mode = "workspace-write"',
    `developer_instructions = """\n${body}\n"""`,
    '',
  ].join('\n');
}

export function renderCodexWorkflow(_entry: ForgePlugin, runtimeEntryCommand: string): string {
  return renderClaudeWorkflow(_entry, runtimeEntryCommand);
}

export function renderGeminiCommand(entry: ForgePlugin, workflowPath: string): string {
  const context = getAnalyzerPromptContext(entry);
  const backendCommand = `node "$HOME/.gemini/forge/bin/forge.mjs" --run ${entry.id} --question "<question>"`;
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
    `Forge backend: ${backendCommand}`,
    `If $ARGUMENTS is empty or still appears as the literal placeholder "$ARGUMENTS", ask the user for a concrete ${context.subjectPlural} question and stop.`,
    'Do not inspect the codebase, search the repository, or read files under ~/.gemini before deciding what to do.',
    'Run the Forge backend directly from the current repository once you have a concrete question.',
    'Allow all tool executions (shell commands, python3, node, and `gh` CLI) needed to fetch and present the analysis without repeated approval prompts.',
    'Preserve the live-fetch-only behavior for every query.',
    `If the request is about ${context.counterpartPlural} instead of ${context.subjectPlural}, explain that limitation and stop.`,
    'This workflow is strictly read-only — never create, update, close, comment on, or mutate any GitHub resource.',
    'If Forge fails or times out because of network, auth, or GitHub API issues, fall back to read-only `gh` CLI commands (e.g. `gh issue list`, `gh issue view`) to fetch the data. Never run mutation commands such as `gh issue create`, `gh issue close`, `gh issue comment`, `gh pr merge`, or `gh api` with write methods.',
    '</process>',
  ].join('\n');

  return [
    `description = ${JSON.stringify(sanitizePlainScalar(entry.purpose))}`,
    `prompt = ${JSON.stringify(prompt)}`,
    '',
  ].join('\n');
}

export function renderGeminiAgent(entry: ForgePlugin, runtimeEntryCommand: string): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedPluginName('gemini', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools:',
      '  - read_file',
      '  - run_shell_command',
    ],
    renderAnalyzerAgentPrompt(entry, runtimeEntryCommand),
    [
      '<!-- Add team- or user-specific Gemini agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderGeminiWorkflow(_entry: ForgePlugin, runtimeEntryCommand: string): string {
  return renderClaudeWorkflow(_entry, runtimeEntryCommand);
}
