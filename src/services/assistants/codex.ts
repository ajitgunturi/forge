import path from 'node:path';
import { AssistantAdapter } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { entryRenderer } from './render-entry.js';

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
   * Gets the target path for installing a summonable entry for Codex.
   * Codex typically uses a .codex/ directory for assistant assets.
   */
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    return path.join(cwd, '.codex', `${entry.id}.md`);
  }

  resolveInstallLayout(cwd: string): AssistantInstallLayout {
    const rootPath = path.join(cwd, '.codex');
    return {
      rootPath,
      agentsPath: rootPath,
    };
  }

  /**
   * Renders the assistant-agnostic entry into the native format for Codex.
   */
  render(entry: SummonableEntry): string {
    return entryRenderer.renderToMarkdown(entry);
  }
}

export const codexAdapter = new CodexAdapter();
