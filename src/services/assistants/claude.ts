import path from 'node:path';
import { AssistantAdapter } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { entryRenderer } from './render-entry.js';

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
   * Gets the target path for installing a summonable entry for Claude.
   * Claude typically uses a .claude/ directory for custom instructions.
   */
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    return path.join(cwd, '.claude', `${entry.id}.md`);
  }

  resolveInstallLayout(cwd: string): AssistantInstallLayout {
    const rootPath = path.join(cwd, '.claude');
    return {
      rootPath,
      agentsPath: rootPath,
    };
  }

  /**
   * Renders the assistant-agnostic entry into the native format for Claude.
   */
  render(entry: SummonableEntry): string {
    // Claude can consume standard Markdown entries
    return entryRenderer.renderToMarkdown(entry);
  }
}

export const claudeAdapter = new ClaudeAdapter();
