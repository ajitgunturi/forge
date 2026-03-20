import os from 'node:os';
import path from 'node:path';
import { AssistantAdapter, AssistantSupplementalAsset } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { getExposedPluginName } from './exposure.js';
import {
  getWorkflowFileName,
  renderCodexAgent,
  renderCodexAgentToml,
  renderCodexSkill,
  renderCodexWorkflow,
} from './runtime-rendering.js';

/**
 * Codex adapter for Forge.
 *
 * This adapter handles Codex-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class CodexAdapter implements AssistantAdapter {
  readonly id: AssistantId = 'codex';
  readonly name = 'Codex';
  readonly description = 'Codex-native assistant entrypoints and toolsets.';

  /**
   * Checks if Codex's environment is available.
   */
  async checkAvailability(): Promise<AssistantAvailability> {
    return {
      id: this.id,
      isAvailable: true,
    };
  }

  /**
   * Codex uses ~/.codex/skills for user-level skill entrypoints.
   */
  getInstallTarget(cwd: string, entry: ForgePlugin): string {
    const layout = this.resolveInstallLayout(cwd);
    return path.join(
      layout.skillsPath ?? path.join(layout.rootPath, 'skills'),
      getExposedPluginName(this.id, 'skill', entry),
      'SKILL.md',
    );
  }

  resolveInstallLayout(_cwd: string): AssistantInstallLayout {
    const rootPath = path.join(os.homedir(), '.codex');
    return {
      rootPath,
      agentsPath: path.join(rootPath, 'agents'),
      skillsPath: path.join(rootPath, 'skills'),
      workflowsPath: path.join(rootPath, 'forge', 'workflows'),
    };
  }

  /**
   * Renders the Codex skill entrypoint.
   */
  render(entry: ForgePlugin): string {
    const layout = this.resolveInstallLayout('');
    const workflowPath = path.join(
      layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
      getWorkflowFileName(entry),
    );
    return renderCodexSkill(entry, workflowPath);
  }

  getSupplementalAssets(cwd: string, entry: ForgePlugin): AssistantSupplementalAsset[] {
    const layout = this.resolveInstallLayout(cwd);
    const agentName = getExposedPluginName(this.id, 'agent', entry);

    return [
      {
        targetPath: path.join(layout.agentsPath, `${agentName}.md`),
        content: renderCodexAgent(entry),
      },
      {
        targetPath: path.join(layout.agentsPath, `${agentName}.toml`),
        content: renderCodexAgentToml(entry),
      },
      {
        targetPath: path.join(
          layout.workflowsPath ?? path.join(layout.rootPath, 'forge', 'workflows'),
          getWorkflowFileName(entry),
        ),
        content: renderCodexWorkflow(entry),
      },
    ];
  }

  getAssetMigrationSources(cwd: string, entry: ForgePlugin): Record<string, string[]> {
    const layout = this.resolveInstallLayout(cwd);
    return {
      [this.getInstallTarget(cwd, entry)]: [
        path.join(cwd, '.codex', `${getExposedPluginName('claude', 'command', entry)}.md`),
        path.join(cwd, '.codex', `${entry.id}.md`),
        path.join(layout.rootPath, `${getExposedPluginName('claude', 'command', entry)}.md`),
        path.join(layout.rootPath, `${entry.id}.md`),
      ],
    };
  }

  getObsoleteAssetPaths(cwd: string, entry: ForgePlugin): string[] {
    return [
      path.join(cwd, '.codex', `${getExposedPluginName('claude', 'command', entry)}.md`),
      path.join(cwd, '.codex', `${entry.id}.md`),
      path.join(this.resolveInstallLayout(cwd).rootPath, `${getExposedPluginName('claude', 'command', entry)}.md`),
      path.join(this.resolveInstallLayout(cwd).rootPath, `${entry.id}.md`),
    ].filter((assetPath) => assetPath !== this.getInstallTarget(cwd, entry));
  }

  getObsoleteDirectoryPaths(cwd: string): string[] {
    return [path.join(cwd, '.codex')];
  }
}

export const codexAdapter = new CodexAdapter();
