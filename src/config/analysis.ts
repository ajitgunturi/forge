import { SIDECAR_DIR_NAME } from './sidecar.js';

/**
 * Analysis artifact subdirectory within the sidecar.
 *
 * All analysis-related data (historical runs, latest pointers)
 * resides in this subdirectory of the `.forge` sidecar.
 */
export const ANALYSIS_SUBDIR = 'analysis';

/**
 * Historical runs subdirectory within the analysis subtree.
 *
 * Stores the full AnalysisRun JSON artifacts named by their ID/timestamp.
 */
export const RUNS_SUBDIR = 'runs';

/**
 * Stable pointer to the latest analysis run artifact.
 *
 * This file (or symlink, conceptually) allows Forge to find the most
 * recent analysis without iterating through the history.
 */
export const LATEST_RUN_POINTER = 'latest.json';

/**
 * Returns the relative path to the analysis subtree from the sidecar root.
 */
export const ANALYSIS_PATH = ANALYSIS_SUBDIR;
