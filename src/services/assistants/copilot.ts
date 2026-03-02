import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnalysisRun } from '../../contracts/analysis.js';
import { PlanRun } from '../../contracts/planning.js';
import { planningGenerator } from '../planning/generator.js';

/**
 * GitHub Copilot adapter for Forge.
 *
 * This service handles Copilot-specific conventions and materializes
 * native entrypoints for the assistant.
 */
export class CopilotAdapter {
  private readonly assetPath: string;

  constructor() {
    // Resolve asset path relative to this file's directory
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    this.assetPath = path.resolve(__dirname, '../../assets/copilot/agent.md');
  }

  /**
   * Materializes the native GitHub Copilot agent entrypoint into the target repository.
   *
   * @param repoRoot The root directory of the repository to install into.
   * @returns The absolute path to the written entrypoint.
   */
  async install(repoRoot: string): Promise<string> {
    const targetDir = path.join(repoRoot, '.github');
    const targetPath = path.join(targetDir, 'copilot-instructions.md');

    // Ensure the .github directory exists
    await mkdir(targetDir, { recursive: true });

    // Read the asset content
    const content = await readFile(this.assetPath, 'utf8');

    // Write to the target location
    await writeFile(targetPath, content, 'utf8');

    return targetPath;
  }

  /**
   * Generates a plan for GitHub Copilot, delegating to the shared planning engine.
   *
   * This method can be extended to include Copilot-specific metadata or formatting
   * that the shared engine doesn't need to know about.
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
