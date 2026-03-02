import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { SidecarContext } from '../sidecar.js';
import { readMetadata, writeMetadata } from '../metadata.js';
import { PLANNING_SUBDIR, PLANS_SUBDIR, LATEST_PLAN_POINTER } from '../../config/planning.js';
import { PlanRun, PlanRunSummary } from '../../contracts/planning.js';

/**
 * Resolved paths for planning artifacts.
 */
export interface PlanningPaths {
  /** Root directory for planning artifacts within .forge sidecar. */
  base: string;
  /** Directory for historical plan runs. */
  plans: string;
  /** Path to the latest plan run JSON artifact. */
  latest: string;
  /** Path to the latest plan run Markdown artifact. */
  latestMarkdown: string;
}

/**
 * Derives the planning paths from the sidecar context.
 */
export function derivePlanningPaths(context: SidecarContext): PlanningPaths {
  const base = path.join(context.sidecarPath, PLANNING_SUBDIR);
  return {
    base,
    plans: path.join(base, PLANS_SUBDIR),
    latest: path.join(base, LATEST_PLAN_POINTER),
    latestMarkdown: path.join(base, 'latest.md'),
  };
}

/**
 * Converts a PlanRun into a human-reviewable Markdown format.
 */
export function planToMarkdown(run: PlanRun): string {
  const lines: string[] = [
    `# Action Plan: ${run.title}`,
    '',
    `**ID:** \`${run.id}\`  `,
    `**Timestamp:** ${run.timestamp}  `,
    `**Analysis ID:** \`${run.analysisRunId}\`  `,
    '',
    '## Objective',
    run.objective,
    '',
    '## Actions',
    '',
  ];

  for (const action of run.actions) {
    lines.push(`### ${action.title}`);
    lines.push(`**Type:** ${action.type}  `);
    lines.push(`**Rationale:** ${action.rationale}`);
    lines.push('');
    lines.push(action.description);
    lines.push('');
    if (action.files && action.files.length > 0) {
      lines.push('**Files:**');
      action.files.forEach(f => lines.push(`- \`${f}\``));
      lines.push('');
    }
    if (action.needsVerification) {
      lines.push('> [!IMPORTANT]');
      lines.push('> This action requires human verification before execution.');
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('## Metadata');
  lines.push(`- **Advisory:** ${run.metadata.isAdvisory ? 'Yes' : 'No'}`);
  if (run.metadata.suggestedReviewer) {
    lines.push(`- **Suggested Reviewer:** ${run.metadata.suggestedReviewer}`);
  }
  if (run.metadata.invocation?.task) {
    lines.push(`- **Task:** ${run.metadata.invocation.task}`);
  }
  if (run.metadata.invocation?.discussionId) {
    lines.push(`- **Discussion ID:** ${run.metadata.invocation.discussionId}`);
  }

  return lines.join('\n');
}

/**
 * Updates the sidecar metadata with the summary of a plan run.
 */
export async function registerPlanRun(
  context: SidecarContext,
  summary: PlanRunSummary
): Promise<void> {
  const metadata = await readMetadata(context.metadataPath);
  if (!metadata) {
    throw new Error(`Metadata file not found at ${context.metadataPath}`);
  }

  // Initialize planning section if it doesn't exist
  if (!metadata.planning) {
    metadata.planning = {
      history: [],
    };
  }

  metadata.planning.lastPlanId = summary.id;
  metadata.planning.history.push(summary);
  metadata.updatedAt = new Date().toISOString();

  await writeMetadata(context.metadataPath, metadata);
}

/**
 * Persists a plan run to disk, updates the 'latest' pointer, and
 * registers the run in the sidecar metadata.
 */
export async function persistPlanRun(
  context: SidecarContext,
  run: PlanRun
): Promise<PlanRunSummary> {
  const paths = derivePlanningPaths(context);

  // Ensure directories exist
  await mkdir(paths.plans, { recursive: true });

  const filename = `${run.id}.json`;
  const mdFilename = `${run.id}.md`;
  const artifactPath = path.join(paths.plans, filename);
  const mdPath = path.join(paths.plans, mdFilename);
  
  const payload = JSON.stringify(run, null, 2);
  const markdown = planToMarkdown(run);

  // Write full historical plan
  await writeFile(artifactPath, payload, 'utf-8');
  await writeFile(mdPath, markdown, 'utf-8');

  // Update latest pointers
  await writeFile(paths.latest, payload, 'utf-8');
  await writeFile(paths.latestMarkdown, markdown, 'utf-8');

  // Return summary for metadata update
  const summary: PlanRunSummary = {
    id: run.id,
    timestamp: run.timestamp,
    analysisRunId: run.analysisRunId,
    artifactPath: path.relative(context.sidecarPath, artifactPath),
  };

  // Register in metadata index
  await registerPlanRun(context, summary);

  return summary;
}

/**
 * Loads the latest plan run from disk.
 * Returns null if no plan has been generated.
 */
export async function loadLatestPlan(context: SidecarContext): Promise<PlanRun | null> {
  const paths = derivePlanningPaths(context);
  try {
    const data = await readFile(paths.latest, 'utf-8');
    return JSON.parse(data) as PlanRun;
  } catch (err) {
    // No plan run found or invalid format
    return null;
  }
}
