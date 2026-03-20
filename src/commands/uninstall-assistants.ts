import os from 'node:os';
import path from 'node:path';
import { assistantInstallService } from '../services/assistants/install.js';
import { AssistantId, AssistantOperationResult } from '../contracts/assistants.js';
import { PluginGroup } from '../services/assistants/summonables.js';

const DEFAULT_ASSISTANTS: AssistantId[] = ['copilot', 'claude', 'codex', 'gemini'];

/**
 * Handles the CLI surface for removing Forge-managed assistant assets.
 */
export async function uninstallAssistantsCommand(
  cwd: string,
  options: { verbose?: boolean; assistants?: AssistantId[]; pluginGroups?: PluginGroup[] } = {},
): Promise<void> {
  const requestedAssistants = options.assistants ?? DEFAULT_ASSISTANTS;
  printUninstallTargets(requestedAssistants, cwd);

  const results = await assistantInstallService.uninstallDefaultSummonables(cwd, requestedAssistants, options.pluginGroups);

  let removedAnyAssets = false;
  let hadFailure = false;
  for (const result of results) {
    const statusIcon = getStatusIcon(result.status);
    console.log(`${statusIcon} ${result.id.padEnd(10)}: ${result.message}`);

    if (options.verbose) {
      for (const detail of result.details ?? []) {
        console.log(`   · ${detail}`);
      }
    }

    if (result.status === 'success') {
      removedAnyAssets = true;
    } else if (result.status === 'failed') {
      hadFailure = true;
    }
  }

  if (removedAnyAssets) {
    console.log('Forge assistant assets were removed for the selected assistant targets.');
    return;
  }

  if (hadFailure) {
    console.log('Forge assistant asset removal finished with errors. Check the status messages above.');
    return;
  }

  console.log('No Forge assistant assets were found for the selected assistant targets.');
}

function printUninstallTargets(assistantIds: AssistantId[], _cwd: string = process.cwd()): void {
  if (assistantIds.includes('copilot')) {
    console.log(`Removing Forge Copilot assets from ${os.homedir()}/.copilot...`);
  }

  if (assistantIds.includes('claude')) {
    console.log(`Removing Forge Claude assets from ${os.homedir()}/.claude...`);
  }

  if (assistantIds.includes('codex')) {
    console.log(`Removing Forge Codex assets from ${path.join(os.homedir(), '.codex')}...`);
  }

  if (assistantIds.includes('gemini')) {
    console.log(`Removing Forge Gemini assets from ${path.join(os.homedir(), '.gemini')}...`);
  }
}

function getStatusIcon(status: AssistantOperationResult['status']): string {
  switch (status) {
    case 'success': return '✅';
    case 'skipped': return '⏭️';
    case 'no-op': return '➖';
    case 'failed': return '❌';
    default: return '❓';
  }
}
