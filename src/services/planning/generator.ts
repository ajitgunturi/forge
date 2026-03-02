import { AnalysisRun, Recommendation } from '../../contracts/analysis.js';
import { PlanRun, ActionItem } from '../../contracts/planning.js';

/**
 * Planning generator that turns repository analysis into structured action plans.
 *
 * This engine is deterministic and grounded in the recommendations and
 * observed facts from a specific analysis run.
 */
export class PlanningGenerator {
  /**
   * Generates a plan run based on the provided analysis run and optional invocation context.
   */
  generate(analysis: AnalysisRun, invocation?: { task?: string; discussionId?: string }): PlanRun {
    const actions: ActionItem[] = [];

    // Map each recommendation to one or more action items
    for (const recommendation of analysis.recommendations) {
      const recommendationActions = this.mapRecommendationToActions(recommendation);
      actions.push(...recommendationActions);
    }

    const timestamp = new Date().toISOString();
    const id = timestamp.replace(/[:.]/g, '-');

    return {
      version: '1.0',
      id,
      timestamp,
      analysisRunId: analysis.id,
      title: invocation?.task ? `Plan: ${invocation.task}` : `Plan based on Analysis ${analysis.id}`,
      objective: invocation?.task 
        ? `Develop a plan for the task: ${invocation.task}` 
        : 'Address recommendations identified during repository analysis.',
      actions,
      assumptions: [
        'The repository state has not significantly changed since the analysis run.',
        'Dependencies can be resolved by the current package manager.',
      ],
      metadata: {
        isAdvisory: true,
        suggestedReviewer: 'Maintainer',
        evidenceReferences: [
          `Analysis Run ID: ${analysis.id}`,
          `Commit Hash: ${analysis.observedFacts.repository.commitHash}`,
        ],
        invocation,
      },
    };
  }

  /**
   * Maps a single recommendation to a set of atomic action items.
   */
  private mapRecommendationToActions(recommendation: Recommendation): ActionItem[] {
    const actions: ActionItem[] = [];

    // Heuristic mapping logic based on recommendation IDs or categories
    switch (recommendation.id) {
      case 'REC-STACK-01': // Missing typescript dependency
        actions.push({
          id: `${recommendation.id}-ACTION-01`,
          type: 'dependency-add',
          title: 'Add typescript to devDependencies',
          description: 'Install typescript as a development dependency using the detected package manager.',
          rationale: recommendation.rationale,
          recommendationIds: [recommendation.id],
          needsVerification: false,
        });
        break;

      case 'REC-ASST-01': // Missing assistant instructions
        actions.push({
          id: `${recommendation.id}-ACTION-01`,
          type: 'file-create',
          title: 'Create CLAUDE.md',
          description: 'Create a CLAUDE.md file with initial repository instructions and coding standards.',
          files: ['CLAUDE.md'],
          rationale: recommendation.rationale,
          recommendationIds: [recommendation.id],
          needsVerification: true,
        });
        break;

      default:
        // Generic action for unhandled recommendations
        actions.push({
          id: `${recommendation.id}-ACTION-GENERIC`,
          type: recommendation.suggestedAction ? 'command-run' : 'manual-step',
          title: `Address: ${recommendation.description}`,
          description: recommendation.suggestedAction || recommendation.description,
          rationale: recommendation.rationale,
          recommendationIds: [recommendation.id],
          needsVerification: true,
        });
    }

    return actions;
  }
}

export const planningGenerator = new PlanningGenerator();
