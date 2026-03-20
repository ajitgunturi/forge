/**
 * Supported assistant identifiers and capability contracts.
 */

export type AssistantId = 'claude' | 'copilot' | 'codex' | 'gemini';

export interface AssistantCapability {
  /** Unique identifier for the assistant */
  id: AssistantId;
  /** Human-readable name of the assistant */
  name: string;
  /** Whether this assistant is currently supported in the runtime */
  isSupported: boolean;
  /** Primary installation target (e.g., '.github/copilot-instructions.md') */
  installTarget: string;
}

export interface AssistantRegistryEntry {
  id: AssistantId;
  name: string;
  description: string;
  docsUrl?: string;
}

/**
 * Result of an assistant availability check.
 */
export interface AssistantAvailability {
  id: AssistantId;
  isAvailable: boolean;
  reason?: string;
  requirement?: string;
}

export interface AssistantInstallLayout {
  rootPath: string;
  agentsPath: string;
  commandsPath?: string;
  skillsPath?: string;
  workflowsPath?: string;
}

/**
 * Result of an assistant installation or update operation.
 */
export interface AssistantOperationResult {
  id: AssistantId;
  status: 'success' | 'skipped' | 'failed' | 'no-op';
  message: string;
  filePath?: string;
  details?: string[];
}
