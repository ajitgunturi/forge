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
  renderClaudeAgent,
  renderClaudeCommand,
  renderClaudeWorkflow,
} from './runtime-rendering.js';

/**
 * Claude adapter for Forge.
 *
 * This adapter handles Claude-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class ClaudeAdapter implements AssistantAdapter {
  readonly id: AssistantId = 'claude';
  readonly name = 'Claude';
  readonly description = 'Anthropic Claude-native assistant entrypoints.';

  /**
   * Checks if Claude's environment is available.
   * For v1, we assume it is always available if Forge is installed.
   */
  async checkAvailability(): Promise<AssistantAvailability> {
    return {
      id: this.id,
      isAvailable: true,
    };
  }

  /**
   * Claude uses ~/.claude/commands for user-level command entrypoints.
   */
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    const layout = this.resolveInstallLayout(cwd);
    return path.join(
      layout.commandsPath ?? path.join(layout.rootPath, 'commands'),
      getCommandDirectoryName(entry),
      getCommandFileName(entry, 'md'),
    );
  }

  resolveInstallLayout(_cwd: string): AssistantInstallLayout {
    const rootPath = path.join(os.homedir(), '.claude');
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
   * Renders the Claude command entrypoint.
   */
  render(entry: SummonableEntry): string {
    const layout = this.resolveInstallLayout('');
    const workflowPath = path.join(
      layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
      getWorkflowFileName(entry),
    );
    return renderClaudeCommand(entry, workflowPath);
  }

  getSupplementalAssets(cwd: string, entry: SummonableEntry): AssistantSupplementalAsset[] {
    const layout = this.resolveInstallLayout(cwd);
    const runtimeEntryCommand = 'node "$HOME/.claude/forge/bin/forge.mjs"';
    return [
      {
        targetPath: path.join(layout.agentsPath, `${getExposedSummonableName(this.id, 'agent', entry)}.md`),
        content: renderClaudeAgent(entry, runtimeEntryCommand),
      },
      {
        targetPath: path.join(
          layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
          getWorkflowFileName(entry),
        ),
        content: renderClaudeWorkflow(entry, runtimeEntryCommand),
      },
    ];
  }

  getAssetMigrationSources(cwd: string, entry: SummonableEntry): Record<string, string[]> {
    const layout = this.resolveInstallLayout(cwd);
    const namespacedAgentPath = path.join(layout.agentsPath, `${getExposedSummonableName('claude', 'command', entry)}.md`);
    const namespacedSkillPath = path.join(
      layout.rootPath,
      'skills',
      getExposedSummonableName('claude', 'command', entry),
      'SKILL.md',
    );
    const legacySkillPath = path.join(layout.rootPath, 'skills', entry.id, 'SKILL.md');
    const agentPath = this.getSupplementalAssets(cwd, entry)[0]!.targetPath;

    return {
      [this.getInstallTarget(cwd, entry)]: [namespacedSkillPath, legacySkillPath],
      [agentPath]: [namespacedAgentPath],
    };
  }

  getObsoleteAssetPaths(cwd: string, entry: SummonableEntry): string[] {
    const layout = this.resolveInstallLayout(cwd);
    const namespacedAgentPath = path.join(layout.agentsPath, `${getExposedSummonableName('claude', 'command', entry)}.md`);
    const namespacedSkillDir = path.join(layout.rootPath, 'skills', getExposedSummonableName('claude', 'command', entry));
    const legacySkillDir = path.join(layout.rootPath, 'skills', entry.id);

    return [
      namespacedAgentPath,
      namespacedSkillDir,
      legacySkillDir,
    ].filter((assetPath): assetPath is string => Boolean(assetPath));
  }
}

export const claudeAdapter = new ClaudeAdapter();
