import os from 'node:os';
import { assistantInstallService } from '../services/assistants/install.js';
import { AssistantId, AssistantOperationResult } from '../contracts/assistants.js';

/**
 * Handles the CLI surface for installing the currently exposed Copilot summonables.
 *
 * Other assistant adapters remain in the codebase but are not exposed in the user-facing CLI yet.
 */
export async function installAssistantsCommand(cwd: string, options: { verbose?: boolean } = {}): Promise<void> {
  try {
    const requestedAssistants: AssistantId[] = ['copilot'];
    const copilotRoot = `${os.homedir()}/.copilot`;

    console.log(`Installing Forge Copilot runtime to ${copilotRoot}...`);

    const results = await assistantInstallService.installDefaultSummonables(cwd, requestedAssistants);

    let hasSuccess = false;
    for (const result of results) {
      const statusIcon = getStatusIcon(result.status);
      console.log(`${statusIcon} ${result.id.padEnd(10)}: ${result.message}`);
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
      console.log('You can now use Copilot /agent with forge-discussion-analyzer.');
    } else {
      console.log('\nCopilot summonables were not installed or updated. Check the status messages above.');
    }
  } catch (error) {
    throw error;
  }
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
