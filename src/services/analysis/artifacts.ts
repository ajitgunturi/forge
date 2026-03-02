import path from 'node:path';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { SidecarContext } from '../sidecar.js';
import { ANALYSIS_SUBDIR, RUNS_SUBDIR, LATEST_RUN_POINTER } from '../../config/analysis.js';
import { AnalysisRun, AnalysisRunSummary } from '../../contracts/analysis.js';

/**
 * Resolved paths for analysis artifacts.
 */
export interface AnalysisPaths {
  /**
   * Root directory for analysis artifacts within .forge sidecar.
   */
  base: string;

  /**
   * Directory for historical analysis runs.
   */
  runs: string;

  /**
   * Path to the latest analysis run JSON artifact.
   */
  latest: string;
}

/**
 * Derives the analysis paths from the sidecar context.
 */
export function deriveAnalysisPaths(context: SidecarContext): AnalysisPaths {
  const base = path.join(context.sidecarPath, ANALYSIS_SUBDIR);
  return {
    base,
    runs: path.join(base, RUNS_SUBDIR),
    latest: path.join(base, LATEST_RUN_POINTER),
  };
}

/**
 * Persists an analysis run to disk and updates the 'latest' pointer.
 *
 * This performs two writes:
 * 1. A durable historical record in the `runs/` subdirectory.
 * 2. A copy to the `latest.json` pointer for easy retrieval.
 */
export async function persistAnalysisRun(
  context: SidecarContext,
  run: AnalysisRun
): Promise<AnalysisRunSummary> {
  const paths = deriveAnalysisPaths(context);

  // Ensure directories exist
  await mkdir(paths.runs, { recursive: true });

  const filename = `${run.id}.json`;
  const artifactPath = path.join(paths.runs, filename);
  const payload = JSON.stringify(run, null, 2);

  // Write full historical run
  await writeFile(artifactPath, payload, 'utf-8');

  // Update latest pointer with a full copy for immediate consumption
  // rather than forced double-hop lookups from metadata.
  await writeFile(paths.latest, payload, 'utf-8');

  // Return summary for metadata update
  return {
    id: run.id,
    timestamp: run.timestamp,
    commitHash: run.observedFacts.repository.commitHash,
    artifactPath: path.relative(context.sidecarPath, artifactPath),
  };
}

/**
 * Loads the latest analysis run from disk.
 * Returns null if no analysis has been performed.
 */
export async function loadLatestAnalysis(context: SidecarContext): Promise<AnalysisRun | null> {
  const paths = deriveAnalysisPaths(context);
  try {
    const data = await readFile(paths.latest, 'utf-8');
    return JSON.parse(data) as AnalysisRun;
  } catch (err) {
    // No analysis run found or invalid format
    return null;
  }
}
