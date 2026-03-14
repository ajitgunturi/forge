import { AssistantId, AssistantAvailability, AssistantOperationResult, AssistantCapability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { claudeAdapter } from './claude.js';
import { codexAdapter } from './codex.js';
import { copilotAdapter } from './copilot.js';
import { geminiAdapter } from './gemini.js';

/**
 * Interface for an assistant-specific adapter.
 *
 * Each supported assistant (Claude, Copilot, etc.) provides an adapter that handles
 * native rendering, installation targets, and environmental availability checks.
 */
export interface AssistantSupplementalAsset {
  targetPath: string;
  content: string;
}

export interface AssistantAdapter {
  id: AssistantId;
  name: string;
  description: string;
  
  /** Checks if the assistant's environment is available on the current machine */
  checkAvailability(): Promise<AssistantAvailability>;
  
  /** Gets the target path for installing a summonable entry for this assistant */
  getInstallTarget(cwd: string, entry: ForgePlugin): string;

  /** Resolves install directories and runtime locations for this assistant */
  resolveInstallLayout(cwd: string): AssistantInstallLayout;
  
  /** Renders the assistant-agnostic entry into the native format for this assistant */
  render(entry: ForgePlugin): string;

  /** Optional supplemental assets (for example, skills) that should be installed alongside the primary entry */
  getSupplementalAssets?(cwd: string, entry: ForgePlugin): AssistantSupplementalAsset[];

  /** Optional legacy asset files whose preserved user content should seed the new asset path on migration */
  getAssetMigrationSources?(cwd: string, entry: ForgePlugin): Record<string, string[]>;

  /** Optional obsolete assets that should be removed after a successful install */
  getObsoleteAssetPaths?(cwd: string, entry: ForgePlugin): string[];

  /** Optional empty directories that should be pruned after a successful install */
  getObsoleteDirectoryPaths?(cwd: string): string[];
}

/**
 * AssistantRegistry: Central manager for supported AI assistant adapters.
 */
export class AssistantRegistry {
  private adapters: Map<AssistantId, AssistantAdapter> = new Map();

  /**
   * Registers a new assistant adapter.
   */
  register(adapter: AssistantAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  /**
   * Gets an adapter by ID.
   */
  get(id: AssistantId): AssistantAdapter | undefined {
    return this.adapters.get(id);
  }

  /**
   * Lists all supported assistant capabilities.
   */
  listCapabilities(): AssistantCapability[] {
    return Array.from(this.adapters.values()).map(a => ({
      id: a.id,
      name: a.name,
      isSupported: true, // If it's in the registry, it's supported by the code
      installTarget: 'dynamic' // Targets are per-entry/CWD
    }));
  }

  listAdapters(): AssistantAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Checks availability for all registered assistants.
   */
  async checkAllAvailability(): Promise<AssistantAvailability[]> {
    const results: AssistantAvailability[] = [];
    for (const adapter of this.adapters.values()) {
      results.push(await adapter.checkAvailability());
    }
    return results;
  }
}

export const assistantRegistry = new AssistantRegistry();

// Register built-in assistants
assistantRegistry.register(claudeAdapter);
assistantRegistry.register(codexAdapter);
assistantRegistry.register(copilotAdapter);
assistantRegistry.register(geminiAdapter);
