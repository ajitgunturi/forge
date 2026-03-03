import path from 'node:path';
import { AssistantAdapter } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { entryRenderer } from './render-entry.js';

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
   * Gets the target path for installing a summonable entry for Gemini.
   * Gemini typically uses a .gemini/ directory for assistant context.
   */
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    return path.join(cwd, '.gemini', `${entry.id}.md`);
  }

  resolveInstallLayout(cwd: string): AssistantInstallLayout {
    const rootPath = path.join(cwd, '.gemini');
    return {
      rootPath,
      agentsPath: rootPath,
    };
  }

  /**
   * Renders the assistant-agnostic entry into the native format for Gemini.
   */
  render(entry: SummonableEntry): string {
    return entryRenderer.renderToMarkdown(entry);
  }
}

export const geminiAdapter = new GeminiAdapter();
