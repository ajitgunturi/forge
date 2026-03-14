/**
 * Shared internal model for a Forge plugin.
 *
 * A ForgePlugin represents a capability that Forge exposes to an assistant,
 * such as an analyzer or a planning specialist. This model remains
 * assistant-agnostic while adapters handle native presentation (e.g., Markdown,
 * JSON, or specialized prompt formats).
 */

export interface ForgePluginCapability {
  name: string;
  description: string;
  benefits: string[];
}

export interface ForgePluginCommand {
  name: string;
  description: string;
  usage: string;
  examples?: string[];
}

/**
 * ForgePlugin: The core model for an assistant-facing Forge capability.
 */
export interface ForgePlugin {
  /** Unique identity for this plugin (e.g., 'forge-discussion-analyzer') */
  id: string;
  /** Display name for the assistant persona */
  displayName: string;
  /** High-level purpose of this assistant persona */
  purpose: string;
  /** Core instructions/prompt for the assistant */
  instructions: string;
  /** Specific capabilities exposed by this plugin */
  capabilities: ForgePluginCapability[];
  /** Commands available to the assistant */
  commands: ForgePluginCommand[];
  /** Operating principles for the assistant */
  principles: string[];
  /** Optional metadata for assistant-specific extensions */
  metadata?: Record<string, any>;
}

/**
 * Registry of plugins available in the Forge runtime.
 */
export interface ForgePluginRegistry {
  entries: ForgePlugin[];
  defaultEntryId: string;
}
