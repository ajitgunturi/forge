import path from 'node:path';
import { AssistantAdapter } from './registry.js';
import { AssistantId, AssistantAvailability } from '../../contracts/assistants.js';
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
    return path.join(cwd, '.copilot', 'agents', `${entry.id}.agent.md`);
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

function renderCopilotAgent(entry: SummonableEntry): string {
  const description = sanitizeYamlString(entry.purpose);
  const name = sanitizeYamlString(entry.id);
  const body = entryRenderer.renderToMarkdown(entry);

  return [
    '---',
    `name: ${name}`,
    `description: ${description}`,
    'tools: ["read", "search", "edit", "execute"]',
    'target: github-copilot',
    '---',
    '',
    body,
  ].join('\n');
}

function sanitizeYamlString(value: string): string {
  return JSON.stringify(value.trim());
}
