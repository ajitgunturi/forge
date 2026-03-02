import { SidecarContext } from '../sidecar.js';
import { loadLatestAnalysis } from '../analysis/artifacts.js';
import { persistPlanRun } from './artifacts.js';
import { planningGenerator } from './generator.js';
import { PlanRunSummary } from '../../contracts/planning.js';

/**
 * Orchestrates an end-to-end planning run.
 * 
 * This service ensures that plans are grounded in repository analysis
 * and associated with the invocation context.
 */
export async function runPlanningFlow(
  context: SidecarContext,
  invocation?: { task?: string; discussionId?: string }
): Promise<PlanRunSummary> {
  // 1. Load latest analysis
  const analysis = await loadLatestAnalysis(context);

  if (!analysis) {
    throw new Error(
      'No repository analysis found. Please run "forge analyze" before generating a plan.'
    );
  }

  // 2. Generate plan set grounded in analysis and invocation context
  const plan = planningGenerator.generate(analysis, invocation);

  // 3. Persist the generated plan run artifact (both JSON and Markdown)
  const summary = await persistPlanRun(context, plan);

  return summary;
}
