import { git } from "../services/git.js";
import { initializeSidecar } from "../services/sidecar.js";
import { runPlanningFlow } from "../services/planning/run.js";
import { derivePlanningPaths } from "../services/planning/artifacts.js";

/**
 * Handles the planning command.
 * 
 * Performs an end-to-end planning run:
 * 1. Confirms the current directory is within a Git repository.
 * 2. Initializes or reuses the Forge sidecar.
 * 3. Runs the planning flow (grounded in latest analysis).
 * 4. Persists results and prints a summary.
 */
export async function planCommand(options: { task?: string; context?: string }): Promise<void> {
  // 1. Resolve the Git root
  const repoRoot = await git.getRepoRoot();

  // 2. Initialize the Forge sidecar
  const sidecar = await initializeSidecar(repoRoot);

  // 3. Run planning
  console.log("Generating action plan...");
  const summary = await runPlanningFlow(sidecar, {
    task: options.task,
    discussionId: options.context,
  });

  // 4. Derive paths for reporting
  const paths = derivePlanningPaths(sidecar);

  // 5. Print status summary
  console.log("Planning complete.");
  console.log(`- ID: ${summary.id}`);
  console.log(`- Reviewable plan: ${paths.latestMarkdown}`);
  console.log(`- Machine payload: ${paths.latest}`);
  console.log("\nForge has produced reviewable plans and did not mutate repository code automatically.");
}
