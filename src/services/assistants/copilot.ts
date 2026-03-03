import os from 'node:os';
import path from 'node:path';
import { AssistantAdapter } from './registry.js';
import { AssistantId, AssistantAvailability, AssistantInstallLayout } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { entryRenderer } from './render-entry.js';
import { AnalysisRun } from '../../contracts/analysis.js';
import { PlanRun } from '../../contracts/planning.js';
import { planningGenerator } from '../planning/generator.js';

/**
 * GitHub Copilot adapter for Forge.
 *
 * This adapter handles Copilot-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class CopilotAdapter implements AssistantAdapter {
  readonly id: AssistantId = 'copilot';
  readonly name = 'GitHub Copilot';
  readonly description = 'Native GitHub Copilot agent for repository planning.';

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
  getInstallTarget(cwd: string, entry: SummonableEntry): string {
    return path.join(this.resolveInstallLayout(cwd).agentsPath, `${entry.id}.agent.md`);
  }

  resolveInstallLayout(_cwd: string): AssistantInstallLayout {
    const rootPath = path.join(os.homedir(), '.copilot');
    const runtimePath = path.join(rootPath, 'forge');

    return {
      rootPath,
      agentsPath: path.join(rootPath, 'agents'),
      runtimePath,
      runtimeEntryPath: path.join(runtimePath, 'bin', 'forge.mjs'),
      metadataPath: path.join(runtimePath, 'forge-file-manifest.json'),
      versionPath: path.join(runtimePath, 'VERSION'),
    };
  }

  /**
   * Renders the assistant-agnostic entry into the native format for Copilot.
   */
  render(entry: SummonableEntry): string {
    return renderCopilotAgent(entry);
  }

  /**
   * Generates a plan for GitHub Copilot, delegating to the shared planning engine.
   *
   * This method remains for compatibility with the Phase 3 proof while 
   * the rest of the system transitions to the generalized adapter model.
   */
  async generatePlan(analysis: AnalysisRun): Promise<PlanRun> {
    // Delegate to shared planning engine
    const plan = planningGenerator.generate(analysis);

    // Apply Copilot-specific metadata or overrides
    plan.metadata = {
      ...plan.metadata,
      suggestedReviewer: 'GitHub Copilot Assistant',
    };

    return plan;
  }
}

export const copilotAdapter = new CopilotAdapter();
export const LEGACY_COPILOT_AGENT_IDS = ['forge-agent'];
export const FORGE_MANAGED_START = '<!-- BEGIN FORGE MANAGED BLOCK -->';
export const FORGE_MANAGED_END = '<!-- END FORGE MANAGED BLOCK -->';
export const FORGE_USER_START = '<!-- BEGIN USER CUSTOMIZATIONS -->';
export const FORGE_USER_END = '<!-- END USER CUSTOMIZATIONS -->';

function renderCopilotAgent(entry: SummonableEntry): string {
  const description = sanitizePlainScalar(entry.purpose);
  const name = sanitizePlainScalar(entry.id);
  const body = entryRenderer.renderToMarkdown(entry);

  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'tools:',
    '  - read_file',
    '  - run_in_terminal',
    '  - fetch_webpage',
    '  - grep_search',
    '  - file_search',
    '  - semantic_search',
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

function sanitizePlainScalar(value: string): string {
  return value
    .replace(/\r?\n+/g, ' ')
    .replace(/:\s/g, ' - ')
    .replace(/^["']+|["']+$/g, '')
    .trim();
}

export const COPILOT_RUNTIME_ENTRY = 'node "$HOME/.copilot/forge/bin/forge.mjs"';
