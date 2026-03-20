import os from 'node:os';
import path from 'node:path';
import { AssistantAdapter, AssistantSupplementalAsset } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { entryRenderer } from './render-entry.js';

/**
 * GitHub Copilot adapter for Forge.
 *
 * This adapter handles Copilot-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class CopilotAdapter implements AssistantAdapter {
  readonly id: AssistantId = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly description = 'Native GitHub Copilot summonables for read-only GitHub analysis.';

  /**
   * Checks if Copilot's environment is available.
   */
  async checkAvailability(): Promise<AssistantAvailability> {
    return {
      id: this.id,
      isAvailable: true,
    };
  }

  /**
   * Gets the target path for installing a summonable entry for Copilot.
   */
  getInstallTarget(cwd: string, entry: ForgePlugin): string {
    return path.join(this.resolveInstallLayout(cwd).agentsPath, `${entry.id}.agent.md`);
  }

  resolveInstallLayout(_cwd: string): AssistantInstallLayout {
    const rootPath = path.join(os.homedir(), '.copilot');

    return {
      rootPath,
      agentsPath: path.join(rootPath, 'agents'),
      skillsPath: path.join(rootPath, 'skills'),
    };
  }

  /**
   * Renders the assistant-agnostic entry into the native format for Copilot.
   */
  render(entry: ForgePlugin): string {
    return renderCopilotAgent(entry);
  }

  getSupplementalAssets(cwd: string, entry: ForgePlugin): AssistantSupplementalAsset[] {
    const layout = this.resolveInstallLayout(cwd);
    return [
      {
        targetPath: path.join(layout.skillsPath ?? path.join(layout.rootPath, 'skills'), entry.id, 'SKILL.md'),
        content: renderCopilotSkill(entry),
      },
    ];
  }
}

export const copilotAdapter = new CopilotAdapter();
export const LEGACY_COPILOT_AGENT_IDS = ['forge-agent'];
export const FORGE_MANAGED_START = '<!-- BEGIN FORGE MANAGED BLOCK -->';
export const FORGE_MANAGED_END = '<!-- END FORGE MANAGED BLOCK -->';
export const FORGE_USER_START = '<!-- BEGIN USER CUSTOMIZATIONS -->';
export const FORGE_USER_END = '<!-- END USER CUSTOMIZATIONS -->';

function renderCopilotAgent(entry: ForgePlugin): string {
  const description = sanitizePlainScalar(entry.purpose);
  const name = sanitizePlainScalar(entry.id);
  const body = entryRenderer.renderToMarkdown(entry);

  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'tools: ["bash", "view"]',
    'color: blue',
    '---',
    '',
    FORGE_MANAGED_START,
    body,
    FORGE_MANAGED_END,
    '',
    FORGE_USER_START,
    '<!-- Add team- or user-specific Copilot instructions below this line. -->',
    '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    FORGE_USER_END,
  ].join('\n');
}

function renderCopilotSkill(entry: ForgePlugin): string {
  const description = sanitizePlainScalar(entry.purpose);
  const name = sanitizePlainScalar(entry.id);
  const body = entryRenderer.renderSkillMarkdown(entry);

  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    '---',
    '',
    FORGE_MANAGED_START,
    body,
    FORGE_MANAGED_END,
    '',
    FORGE_USER_START,
    '<!-- Add team- or user-specific Copilot skill instructions below this line. -->',
    '<!-- Keep your custom instructions outside Forge managed markers so updates preserve them. -->',
    FORGE_USER_END,
  ].join('\n');
}

function sanitizePlainScalar(value: string): string {
  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/:\s/g, ' - ')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}
