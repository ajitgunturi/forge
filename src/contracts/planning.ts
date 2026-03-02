/**
 * Action-plan models driven by repository analysis.
 *
 * This contract ensures that generated plans are durable, linked to
 * analysis evidence, and carry metadata for reviewability.
 */

import { Recommendation } from './analysis.js';

/**
 * A single atomic action item in a plan.
 */
export interface ActionItem {
  id: string;
  type: 'file-create' | 'file-modify' | 'dependency-add' | 'command-run' | 'manual-step';
  title: string;
  description: string;
  files?: string[];
  rationale: string;
  /** Link back to recommendations that inspired this action item. */
  recommendationIds: string[];
  /** Flag for items that need explicit human verification before proceeding. */
  needsVerification: boolean;
}

/**
 * PlanRun: The complete durable artifact of a generated plan.
 */
export interface PlanRun {
  /** Schema version for forward/backward compatibility */
  version: '1.0';
  /** Unique identifier for this plan run (ISO timestamp) */
  id: string;
  /** When the plan was generated */
  timestamp: string;
  /** Link back to the analysis run this plan was based on */
  analysisRunId: string;
  /** Human-readable title for the plan */
  title: string;
  /** Strategic context for the plan */
  objective: string;
  /** Core sequence of actions */
  actions: ActionItem[];
  /** Assumptions made during plan generation */
  assumptions: string[];
  /** Reviewability metadata */
  metadata: {
    /** Whether this plan is advisory (it always should be) */
    isAdvisory: boolean;
    /** Recommended reviewer role */
    suggestedReviewer?: string;
    /** Link to evidence in analysis artifacts */
    evidenceReferences: string[];
  };
}

/**
 * Summary pointer for metadata indexing.
 */
export interface PlanRunSummary {
  id: string;
  timestamp: string;
  analysisRunId: string;
  artifactPath: string;
}
