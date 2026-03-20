import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { assistantInstallService } from '../services/assistants/install.js';
import { AssistantId, AssistantOperationResult } from '../contracts/assistants.js';
import { forgeDiscussionAnalyzerEntry, forgeIssueAnalyzerEntry, forgePRCommentsAnalyzerEntry } from '../services/assistants/summonables.js';
import { getExposedPluginName } from '../services/assistants/exposure.js';

const DEFAULT_ASSISTANTS: AssistantId[] = ['copilot', 'claude', 'codex', 'gemini'];
const INTERACTIVE_CHOICES: Array<{
  choice: string;
  label: string;
  pathLabel: string;
  assistants: AssistantId[];
}> = [
  { choice: '1', label: 'GitHub Copilot', pathLabel: '~/.copilot', assistants: ['copilot'] },
  { choice: '2', label: 'Claude Code', pathLabel: '~/.claude', assistants: ['claude'] },
  { choice: '3', label: 'Gemini', pathLabel: '~/.gemini', assistants: ['gemini'] },
  { choice: '4', label: 'Codex', pathLabel: '~/.codex', assistants: ['codex'] },
  { choice: '5', label: 'All', pathLabel: 'install every supported assistant', assistants: DEFAULT_ASSISTANTS },
];

type InstallStyling = {
  bold(value: string): string;
  cyan(value: string): string;
  yellow(value: string): string;
  green(value: string): string;
  dim(value: string): string;
};

/**
 * Handles the CLI surface for installing the currently exposed Forge assistant assets.
 */
export async function installAssistantsCommand(
  cwd: string,
  options: { verbose?: boolean; assistants?: AssistantId[]; version?: string } = {},
): Promise<void> {
  try {
    const interactive = !options.assistants && process.stdin.isTTY && process.stdout.isTTY;
    const styling = createInstallStyling(interactive);
    const requestedAssistants = options.assistants ?? await resolveAssistantSelection(options.version, styling);
    printInstallTargets(requestedAssistants, cwd, { interactive, styling });

    const results = await assistantInstallService.installDefaultSummonables(cwd, requestedAssistants);

    let hasSuccess = false;
    for (const result of results) {
      if (interactive) {
        printInteractiveOperationResult(result, styling);
      } else {
        const statusIcon = getStatusIcon(result.status);
        console.log(`${statusIcon} ${result.id.padEnd(10)}: ${result.message}`);
      }
      if (options.verbose) {
        for (const detail of result.details ?? []) {
          console.log(`   · ${detail}`);
        }
      }
      if (result.status === 'success' || result.status === 'skipped') {
        hasSuccess = true;
      }
    }
    
    if (hasSuccess) {
      const successMessage = buildSuccessMessage(requestedAssistants);
      if (interactive) {
        console.log(`\n${styling.green('Done!')}`);
        console.log(successMessage);
      } else {
        console.log(successMessage);
      }
    } else {
      console.log('\nForge assistant assets were not installed or updated. Check the status messages above.');
    }
  } catch (error) {
    throw error;
  }
}

async function resolveAssistantSelection(version: string | undefined, styling: InstallStyling): Promise<AssistantId[]> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return DEFAULT_ASSISTANTS;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    console.log(renderInteractiveInstallerScreen(version ?? '0.0.0', styling));
    const answer = (await rl.question(styling.bold('  Choice [5]: '))).trim().toLowerCase();
    const selection = resolveInteractiveAssistantChoice(answer);

    if (selection) {
      return selection;
    }

    console.log(styling.yellow('\n  Unknown choice. Defaulting to All.\n'));
    return DEFAULT_ASSISTANTS;
  } finally {
    rl.close();
  }
}

function printInstallTargets(
  assistantIds: AssistantId[],
  cwd: string = process.cwd(),
  options: { interactive?: boolean; styling?: InstallStyling } = {},
): void {
  if (options.interactive && options.styling) {
    console.log(buildInteractiveInstallSummary(assistantIds, options.styling));
    return;
  }

  if (assistantIds.includes('copilot')) {
    console.log(`Installing Forge Copilot assets to ${os.homedir()}/.copilot...`);
  }

  if (assistantIds.includes('claude')) {
    console.log(`Installing Forge Claude assets to ${os.homedir()}/.claude...`);
  }

  if (assistantIds.includes('codex')) {
    console.log(`Installing Forge Codex assets to ${path.join(os.homedir(), '.codex')}...`);
  }

  if (assistantIds.includes('gemini')) {
    console.log(`Installing Forge Gemini assets to ${path.join(os.homedir(), '.gemini')}...`);
  }
}

function buildSuccessMessage(assistantIds: AssistantId[]): string {
  const lines: string[] = ['Available Forge entrypoints:'];
  const discussionSkill = getExposedPluginName('codex', 'skill', forgeDiscussionAnalyzerEntry);
  const issueSkill = getExposedPluginName('codex', 'skill', forgeIssueAnalyzerEntry);
  const prReviewSkill = getExposedPluginName('codex', 'skill', forgePRCommentsAnalyzerEntry);
  const discussionClaudeCommand = getExposedPluginName('claude', 'command', forgeDiscussionAnalyzerEntry);
  const issueClaudeCommand = getExposedPluginName('claude', 'command', forgeIssueAnalyzerEntry);
  const prReviewClaudeCommand = getExposedPluginName('claude', 'command', forgePRCommentsAnalyzerEntry);
  const discussionGeminiCommand = getExposedPluginName('gemini', 'command', forgeDiscussionAnalyzerEntry);
  const issueGeminiCommand = getExposedPluginName('gemini', 'command', forgeIssueAnalyzerEntry);
  const prReviewGeminiCommand = getExposedPluginName('gemini', 'command', forgePRCommentsAnalyzerEntry);

  if (assistantIds.includes('copilot')) {
    lines.push('- Copilot agents: `/agent forge-discussion-analyzer`, `/agent forge-issue-analyzer`, `/agent forge-pr-comments-analyzer`');
    lines.push('- Copilot skills (gh copilot): `forge-discussion-analyzer`, `forge-issue-analyzer`, `forge-pr-comments-analyzer`');
  }

  if (assistantIds.includes('claude')) {
    lines.push(`- Claude commands: \`${discussionClaudeCommand}\`, \`${issueClaudeCommand}\`, \`${prReviewClaudeCommand}\``);
  }

  if (assistantIds.includes('codex')) {
    lines.push(`- Codex skills: \`$${discussionSkill}\`, \`$${issueSkill}\`, \`$${prReviewSkill}\``);
  }

  if (assistantIds.includes('gemini')) {
    lines.push(`- Gemini commands: \`${discussionGeminiCommand}\`, \`${issueGeminiCommand}\`, \`${prReviewGeminiCommand}\``);
  }

  return lines.length > 1
    ? lines.join('\n')
    : 'Forge assistant assets are ready.';
}

export function renderInteractiveInstallerScreen(version: string, styling: InstallStyling = createInstallStyling(false)): string {
  const bannerLines = [
    '   ███████╗ ██████╗ ██████╗  ██████╗ ███████╗',
    '   ██╔════╝██╔═══██╗██╔══██╗██╔════╝ ██╔════╝',
    '   █████╗  ██║   ██║██████╔╝██║  ███╗█████╗  ',
    '   ██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ',
    '   ██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗',
    '   ╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝',
  ].map((line) => styling.cyan(line));

  const runtimeLines = INTERACTIVE_CHOICES.map((choice) => {
    if (choice.choice === '5') {
      return `  ${styling.bold('5)')} ${styling.bold('All')}`;
    }

    return `  ${styling.bold(`${choice.choice})`)} ${padLabel(choice.label, 15)} ${styling.dim(`(${choice.pathLabel})`)}`;
  });

  return [
    '',
    ...bannerLines,
    '',
    `  ${styling.bold(`Forge v${version}`)}`,
    `  ${styling.dim('Read-only GitHub analysis asset installer for GitHub Copilot, Claude Code, Gemini, and Codex.')}`,
    '',
    `  ${styling.bold('Which assistant(s) would you like to install for?')}`,
    '',
    ...runtimeLines,
    '',
  ].join('\n');
}

export function resolveInteractiveAssistantChoice(answer: string): AssistantId[] | null {
  if (answer === '') {
    return DEFAULT_ASSISTANTS;
  }

  const matchedChoice = INTERACTIVE_CHOICES.find((choice) => choice.choice === answer);
  if (matchedChoice) {
    return matchedChoice.assistants;
  }

  switch (answer) {
    case 'copilot':
      return ['copilot'];
    case 'claude':
      return ['claude'];
    case 'gemini':
      return ['gemini'];
    case 'codex':
      return ['codex'];
    case 'all':
      return DEFAULT_ASSISTANTS;
    default:
      return null;
  }
}

export function buildInteractiveInstallSummary(
  assistantIds: AssistantId[],
  styling: InstallStyling = createInstallStyling(false),
): string {
  if (assistantIds.length === DEFAULT_ASSISTANTS.length) {
    return `\n  ${styling.green('Installing Forge globally')} ${styling.dim('to ~/.copilot, ~/.claude, ~/.gemini, and ~/.codex')}\n`;
  }

  const selected = assistantIds[0];
  const destination = getInstallRootLabel(selected);
  const runtimeLabel = getRuntimeLabel(selected);
  return `\n  ${styling.green(`Installing for ${runtimeLabel}`)} ${styling.dim(`to ${destination}`)}\n`;
}

export function buildInteractiveOperationLines(result: AssistantOperationResult): string[] {
  if (result.status === 'skipped') {
    return ['Already up to date'];
  }

  if (result.status !== 'success') {
    return [result.message];
  }

  const lines = [...getInteractiveAssetLines(result.id)];

  if (result.details?.some((detail) => detail.includes('removed legacy runtime'))) {
    lines.push('Removed legacy runtime');
  }

  if (result.details?.some((detail) => detail.includes('removed obsolete agent'))) {
    lines.push('Removed legacy agent');
  }

  return lines;
}

function printInteractiveOperationResult(result: AssistantOperationResult, styling: InstallStyling): void {
  const icon = result.status === 'failed'
    ? '✕'
    : result.status === 'skipped'
      ? '○'
      : '✓';
  const colorize = result.status === 'failed'
    ? styling.yellow
    : result.status === 'skipped'
      ? styling.dim
      : styling.green;

  const lines = buildInteractiveOperationLines(result);
  for (const line of lines) {
    console.log(`  ${colorize(icon)} ${line}`);
  }
  console.log('');
}

function getRuntimeLabel(assistantId: AssistantId): string {
  switch (assistantId) {
    case 'copilot':
      return 'GitHub Copilot';
    case 'claude':
      return 'Claude Code';
    case 'gemini':
      return 'Gemini';
    case 'codex':
      return 'Codex';
  }
}

function getInstallRootLabel(assistantId: AssistantId): string {
  switch (assistantId) {
    case 'copilot':
      return '~/.copilot';
    case 'claude':
      return '~/.claude';
    case 'gemini':
      return '~/.gemini';
    case 'codex':
      return '~/.codex';
  }
}

function getInteractiveAssetLines(assistantId: AssistantId): string[] {
  switch (assistantId) {
    case 'copilot':
      return ['Installed agent', 'Installed skill'];
    case 'claude':
      return ['Installed command', 'Installed agent', 'Installed workflow'];
    case 'codex':
      return ['Installed skill', 'Installed agents', 'Installed workflow'];
    case 'gemini':
      return ['Installed command', 'Installed agent', 'Installed workflow'];
  }
}

function padLabel(value: string, width: number): string {
  return value.padEnd(width);
}

function createInstallStyling(enabled: boolean): InstallStyling {
  const apply = (open: string, close: string, value: string) => enabled ? `${open}${value}${close}` : value;

  return {
    bold: (value) => apply('\u001B[1m', '\u001B[22m', value),
    cyan: (value) => apply('\u001B[38;5;45m', '\u001B[39m', value),
    yellow: (value) => apply('\u001B[38;5;220m', '\u001B[39m', value),
    green: (value) => apply('\u001B[38;5;84m', '\u001B[39m', value),
    dim: (value) => apply('\u001B[2m', '\u001B[22m', value),
  };
}

/**
 * Maps operation status to a user-friendly CLI icon.
 */
function getStatusIcon(status: AssistantOperationResult['status']): string {
  switch (status) {
    case 'success': return '✅';
    case 'skipped': return '⏭️';
    case 'no-op':   return '➖';
    case 'failed':  return '❌';
    default:        return '❓';
  }
}
