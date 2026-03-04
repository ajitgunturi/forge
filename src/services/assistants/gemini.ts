import os from 'node:os';
import path from 'node:path';
import { AssistantAdapter, AssistantSupplementalAsset } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { getExposedSummonableName } from './exposure.js';
import {
  getCommandDirectoryName,
  getCommandFileName,
  getWorkflowFileName,
  renderGeminiAgent,
  renderGeminiCommand,
  renderGeminiWorkflow,
} from './runtime-rendering.js';

/**
 * Gemini adapter for Forge.
 *
 * This adapter handles Google Gemini-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class GeminiAdapter implements AssistantAdapter {
  readonly id: AssistantId = 'gemini';
  readonly name = 'Gemini';
  readonly description = 'Google Gemini-native assistant entrypoints.';

  /**
   * Checks if Gemini's environment is available.
   */
  async checkAvailability(): Promise<AssistantAvailability> {
    return {
      id: this.id,
      isAvailable: true,
    };
  }

  /**
   * Gemini uses ~/.gemini/commands for user-level command entrypoints.
   */
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    const layout = this.resolveInstallLayout(cwd);
    return path.join(
      layout.commandsPath ?? path.join(layout.rootPath, 'commands'),
      getCommandDirectoryName(entry),
      getCommandFileName(entry, 'toml'),
    );
  }

  resolveInstallLayout(_cwd: string): AssistantInstallLayout {
    const rootPath = path.join(os.homedir(), '.gemini');
    const runtimePath = path.join(rootPath, 'forge');
    return {
      rootPath,
      agentsPath: path.join(rootPath, 'agents'),
      commandsPath: path.join(rootPath, 'commands'),
      workflowsPath: path.join(runtimePath, 'workflows'),
      runtimePath,
      runtimeEntryPath: path.join(runtimePath, 'bin', 'forge.mjs'),
      metadataPath: path.join(runtimePath, 'forge-file-manifest.json'),
      versionPath: path.join(runtimePath, 'VERSION'),
    };
  }

  /**
   * Renders the Gemini command entrypoint.
   */
  render(entry: SummonableEntry): string {
    const layout = this.resolveInstallLayout('');
    const workflowPath = path.join(
      layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
      getWorkflowFileName(entry),
    );
    return renderGeminiCommand(entry, workflowPath);
  }

  getSupplementalAssets(cwd: string, entry: SummonableEntry): AssistantSupplementalAsset[] {
    const layout = this.resolveInstallLayout(cwd);
    const runtimeEntryCommand = 'node "$HOME/.gemini/forge/bin/forge.mjs"';

    return [
      {
        targetPath: path.join(layout.agentsPath, `${getExposedSummonableName(this.id, 'agent', entry)}.md`),
        content: renderGeminiAgent(entry, runtimeEntryCommand),
      },
      {
        targetPath: path.join(
          layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
          getWorkflowFileName(entry),
        ),
        content: renderGeminiWorkflow(entry, runtimeEntryCommand),
      },
    ];
  }

  getAssetMigrationSources(cwd: string, entry: SummonableEntry): Record<string, string[]> {
    const layout = this.resolveInstallLayout(cwd);
    const agentPath = this.getSupplementalAssets(cwd, entry)[0]!.targetPath;
    return {
      [agentPath]: [
        path.join(cwd, '.gemini', `${getExposedSummonableName('gemini', 'command', entry)}.md`),
        path.join(cwd, '.gemini', `${entry.id}.md`),
        path.join(layout.rootPath, `${getExposedSummonableName('gemini', 'command', entry)}.md`),
        path.join(layout.rootPath, `${entry.id}.md`),
      ],
    };
  }

  getObsoleteAssetPaths(cwd: string, entry: SummonableEntry): string[] {
    return [
      path.join(cwd, '.gemini', `${getExposedSummonableName('gemini', 'command', entry)}.md`),
      path.join(cwd, '.gemini', `${entry.id}.md`),
      path.join(this.resolveInstallLayout(cwd).rootPath, `${getExposedSummonableName('gemini', 'command', entry)}.md`),
      path.join(this.resolveInstallLayout(cwd).rootPath, `${entry.id}.md`),
    ].filter((assetPath) => assetPath !== this.getInstallTarget(cwd, entry));
  }

  getObsoleteDirectoryPaths(cwd: string): string[] {
    return [path.join(cwd, '.gemini')];
  }
}

export const geminiAdapter = new GeminiAdapter();
