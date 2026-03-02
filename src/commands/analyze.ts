import { git } from "../services/git.js";
import { runAnalysis } from "../services/analysis/run.js";
import { initializeSidecar } from "../services/sidecar.js";
import { deriveAnalysisPaths } from "../services/analysis/artifacts.js";
import path from "node:path";

/**
 * Handles the repository analysis command.
 * 
 * Performs an end-to-end analysis of the repository:
 * 1. Confirms the current directory is within a Git repository.
 * 2. Initializes or reuses the Forge sidecar.
 * 3. Runs the analysis service (facts + recommendations).
 * 4. Persists results and prints a summary.
 */
export async function analyzeCommand(): Promise<void> {
  // 1. Resolve the Git root (throws RepositoryRequiredError if not in a repo)
  const repoRoot = await git.getRepoRoot();

  // 2. Initialize the Forge sidecar (ensures directory exists)
  const sidecar = await initializeSidecar(repoRoot);

  // 3. Run analysis
  console.log("Analyzing repository...");
  const run = await runAnalysis(repoRoot);

  // 4. Derive paths for reporting
  const paths = deriveAnalysisPaths(sidecar);
  const summaryPath = path.join(paths.base, "SUMMARY.md");

  // 5. Print status summary
  console.log("Analysis complete.");
  console.log(`- ID: ${run.id}`);
  console.log(`- Findings: ${run.recommendations.length} recommendations`);
  console.log(`- Review summary: ${summaryPath}`);
  console.log(`- Machine payload: ${paths.latest}`);
}
