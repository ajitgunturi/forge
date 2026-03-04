import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { FORGE_MANAGED_END, FORGE_MANAGED_START, FORGE_USER_END, FORGE_USER_START } from './copilot.js';
import { getExposedSummonableName, getSummonableRoute } from './exposure.js';

const ANALYZER_DESCRIPTION = 'Analyze GitHub Discussions for the current repository through Forge-managed live fetching and summary artifacts.';

export function sanitizePlainScalar(value: string): string {
  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/:\s/g, ' - ')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

export function getWorkflowFileName(entry: SummonableEntry): string {
  return `${getSummonableRoute(entry.id).localName}.md`;
}

export function getCommandFileName(entry: SummonableEntry, extension: 'md' | 'toml'): string {
  return `${getSummonableRoute(entry.id).localName}.${extension}`;
}

export function getCommandDirectoryName(entry: SummonableEntry): string {
  return getSummonableRoute(entry.id).namespace ?? 'forge';
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

function renderDiscussionAgentPrompt(runtimeEntryCommand: string): string {
  return [
    '<role>',
    'You are the Forge Discussion Analyzer.',
    'Analyze GitHub Discussions for the current repository using Forge as the only backend.',
    '</role>',
    '',
    '<instructions>',
    '- Use this agent for discussion digests, triage, pattern analysis, and follow-up answers.',
    '- If the user asks about GitHub Issues, explain that this analyzer only covers GitHub Discussions and stop.',
    `- Run \`${runtimeEntryCommand} --run forge-discussion-analyzer --question "<question>"\` directly instead of delegating to unrelated helpers.`,
    '- Every query must use a live fetch through Forge; never answer from local cached summaries alone.',
    '- Ask for approval once for the Forge command, then let Forge handle fetch plus analysis.',
    '- Do not run npm install, repair Forge dependencies, or switch to raw GitHub API calls when Forge is available.',
    '- If Forge fails or times out because of network or GitHub API issues, report the Forge failure and stop.',
    '- Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    '- Suggest narrowing by category, relative windows, or explicit after/before dates when the user needs a smaller slice.',
    '</instructions>',
  ].join('\n');
}

export function renderClaudeCommand(entry: SummonableEntry, workflowPath: string): string {
  const commandName = sanitizePlainScalar(getExposedSummonableName('claude', 'command', entry));
  const workflowReference = `@${workflowPath}`;
  const body = [
    '<objective>',
    ANALYZER_DESCRIPTION,
    '</objective>',
    '',
    '<execution_context>',
    workflowReference,
    '</execution_context>',
    '',
    '<context>',
    '$ARGUMENTS',
    '',
    'Ask a concrete question about GitHub Discussions for the current repository.',
    '</context>',
    '',
    '<process>',
    `Execute the workflow from ${workflowReference} end-to-end.`,
    'Preserve the live-fetch-only behavior for every query.',
    'If the request is about GitHub Issues instead of GitHub Discussions, explain that limitation and stop.',
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

export function renderClaudeAgent(entry: SummonableEntry, runtimeEntryCommand: string): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedSummonableName('claude', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools: Bash, Read',
    ],
    renderDiscussionAgentPrompt(runtimeEntryCommand),
    [
      '<!-- Add team- or user-specific Claude agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderClaudeWorkflow(_entry: SummonableEntry, runtimeEntryCommand: string): string {
  return [
    '# Forge Discussion Analyzer Workflow',
    '',
    `Run \`${runtimeEntryCommand} --run forge-discussion-analyzer --question "$ARGUMENTS"\` as the only backend for this workflow.`,
    '',
    'Execution rules:',
    '- Every query must use Forge live fetches; do not answer from local summary content alone.',
    '- If the request is about GitHub Issues instead of GitHub Discussions, explain that this workflow only covers Discussions and stop.',
    '- Ask for approval once for the Forge command, then let Forge handle fetch plus analysis.',
    '- Do not run npm install, repair Forge dependencies, or switch to raw GitHub API calls when Forge is available.',
    '- If Forge fails or times out because of network or GitHub API issues, report the Forge failure and stop.',
  ].join('\n');
}

export function renderCodexSkill(entry: SummonableEntry, workflowPath: string): string {
  const skillName = sanitizePlainScalar(getExposedSummonableName('codex', 'skill', entry));
  const workflowReference = `@${workflowPath}`;
  const body = [
    '<codex_skill_adapter>',
    '## Skill Invocation',
    `- This skill is invoked by mentioning \`$${skillName}\`.`,
    '- Treat all user text after the skill mention as the discussion question.',
    '- If no question is provided, ask the user what they want to know about the repository GitHub Discussions.',
    '</codex_skill_adapter>',
    '',
    '<objective>',
    ANALYZER_DESCRIPTION,
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
    'If the request is about GitHub Issues instead of GitHub Discussions, explain that limitation and stop.',
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

export function renderCodexAgent(entry: SummonableEntry, runtimeEntryCommand: string): string {
  const body = renderDiscussionAgentPrompt(runtimeEntryCommand);
  return renderManagedMarkdown(
    [
      `name: "${sanitizePlainScalar(getExposedSummonableName('codex', 'agent', entry))}"`,
      `description: "${sanitizePlainScalar(entry.purpose)}"`,
    ],
    [
      '<codex_agent_role>',
      `role: ${sanitizePlainScalar(getExposedSummonableName('codex', 'agent', entry))}`,
      'tools: Read, Bash',
      `purpose: ${sanitizePlainScalar(entry.purpose)}`,
      '</codex_agent_role>',
      '',
      body,
    ].join('\n'),
  );
}

export function renderCodexAgentToml(entry: SummonableEntry, runtimeEntryCommand: string): string {
  const body = [
    '<role>',
    'You are the Forge Discussion Analyzer.',
    'Analyze GitHub Discussions for the current repository using Forge as the only backend.',
    '</role>',
    '',
    '<instructions>',
    '- Use this agent for discussion digests, triage, pattern analysis, and follow-up answers.',
    '- If the user asks about GitHub Issues, explain that this analyzer only covers GitHub Discussions and stop.',
    `- Run \`${runtimeEntryCommand} --run forge-discussion-analyzer --question "<question>"\` directly instead of delegating to unrelated helpers.`,
    '- Every query must use a live fetch through Forge; never answer from local cached summaries alone.',
    '- Ask for approval once for the Forge command, then let Forge handle fetch plus analysis.',
    '- Do not run npm install, repair Forge dependencies, or switch to raw GitHub API calls when Forge is available.',
    '- If Forge fails or times out because of network or GitHub API issues, report the Forge failure and stop.',
    '</instructions>',
  ].join('\n');

  return [
    'sandbox_mode = "workspace-write"',
    `developer_instructions = """\n${body}\n"""`,
    '',
  ].join('\n');
}

export function renderCodexWorkflow(_entry: SummonableEntry, runtimeEntryCommand: string): string {
  return renderClaudeWorkflow(_entry, runtimeEntryCommand);
}

export function renderGeminiCommand(entry: SummonableEntry, workflowPath: string): string {
  const prompt = [
    '<objective>',
    ANALYZER_DESCRIPTION,
    '</objective>',
    '',
    '<context>',
    'User question: $ARGUMENTS',
    '',
    'Run in the current repository.',
    '</context>',
    '',
    '<process>',
    `Forge backend: node "$HOME/.gemini/forge/bin/forge.mjs" --run ${entry.id} --question "<question>"`,
    'If $ARGUMENTS is empty or still appears as the literal placeholder "$ARGUMENTS", ask the user for a concrete GitHub Discussions question and stop.',
    'Do not inspect the codebase, search the repository, or read files under ~/.gemini before deciding what to do.',
    'Run the Forge backend directly from the current repository once you have a concrete question.',
    'Preserve the live-fetch-only behavior for every query.',
    'If the request is about GitHub Issues instead of GitHub Discussions, explain that limitation and stop.',
    'If Forge fails or times out because of network, auth, or GitHub API issues, report the Forge failure and stop.',
    '</process>',
  ].join('\n');

  return [
    `description = ${JSON.stringify(sanitizePlainScalar(entry.purpose))}`,
    `prompt = ${JSON.stringify(prompt)}`,
    '',
  ].join('\n');
}

export function renderGeminiAgent(entry: SummonableEntry, runtimeEntryCommand: string): string {
  return renderManagedMarkdown(
    [
      `name: ${sanitizePlainScalar(getExposedSummonableName('gemini', 'agent', entry))}`,
      `description: ${sanitizePlainScalar(entry.purpose)}`,
      'tools:',
      '  - read_file',
      '  - run_shell_command',
    ],
    renderDiscussionAgentPrompt(runtimeEntryCommand),
    [
      '<!-- Add team- or user-specific Gemini agent instructions below this line. -->',
      '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    ],
  );
}

export function renderGeminiWorkflow(_entry: SummonableEntry, runtimeEntryCommand: string): string {
  return renderClaudeWorkflow(_entry, runtimeEntryCommand);
}
