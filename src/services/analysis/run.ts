import { repositoryAnalyzer } from './repository.js';
import { persistAnalysisRun, deriveAnalysisPaths } from './artifacts.js';
import { initializeSidecar, SidecarContext } from '../sidecar.js';
import { AnalysisRun, Recommendation, ObservedFacts } from '../../contracts/analysis.js';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Executes a complete analysis run for the given repository root.
 * Orchestrates initialization, fact-gathering, recommendation derivation, and persistence.
 */
export async function runAnalysis(repoRoot: string): Promise<AnalysisRun> {
  // 1. Initialize sidecar
  const sidecar = await initializeSidecar(repoRoot);

  // 2. Collect observed facts
  const observedFacts = await repositoryAnalyzer.analyze(repoRoot);

  // 3. Derive recommendations
  const recommendations = deriveRecommendations(observedFacts);

  // 4. Create analysis run
  const run: AnalysisRun = {
    version: '1.0',
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    timestamp: new Date().toISOString(),
    observedFacts,
    recommendations,
  };

  // 5. Persist durable artifacts
  await persistAnalysisRun(sidecar, run);

  // 6. Generate human-reviewable summary
  await generateHumanSummary(sidecar, run);

  return run;
}

/**
 * Derives recommendations from observed facts.
 * Currently uses simple heuristic-based rules.
 */
function deriveRecommendations(facts: ObservedFacts): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Stack recommendations
  if (facts.stack.language === 'typescript' && !facts.stack.tools.includes('typescript')) {
    recommendations.push({
      id: 'REC-STACK-01',
      category: 'architecture',
      priority: 'high',
      description: 'Inconsistent TypeScript detection.',
      rationale: 'TypeScript was detected as the primary language, but no typescript dependency was found in the package manifest.',
      suggestedAction: 'Add typescript to devDependencies.',
    });
  }

  // Structure recommendations
  if (facts.structure.directories.length === 0) {
    recommendations.push({
      id: 'REC-STRUC-01',
      category: 'architecture',
      priority: 'medium',
      description: 'Flat repository structure.',
      rationale: 'No top-level directories were found. For larger projects, a structured approach (e.g., src/) is recommended.',
    });
  }

  // Assistant context recommendations
  if (!facts.assistantContext.hasInstructions) {
    recommendations.push({
      id: 'REC-ASST-01',
      category: 'convention',
      priority: 'low',
      description: 'Missing assistant instructions.',
      rationale: 'No assistant instructions file (e.g., CLAUDE.md) was found. Providing explicit rules helps AI assistants be more effective.',
      suggestedAction: 'Create a CLAUDE.md file with repository-specific coding standards and commands.',
    });
  }

  return recommendations;
}

/**
 * Generates a Markdown summary of the analysis run.
 */
async function generateHumanSummary(sidecar: SidecarContext, run: AnalysisRun): Promise<string> {
  const paths = deriveAnalysisPaths(sidecar);
  const summaryPath = path.join(paths.base, 'SUMMARY.md');

  const content = `# Repository Analysis Summary

**ID:** ${run.id}
**Timestamp:** ${run.timestamp}
**Repo Name:** ${run.observedFacts.repository.name}
**Branch:** ${run.observedFacts.repository.branch}
**Commit:** ${run.observedFacts.repository.commitHash}

## Technology Stack
- **Language:** ${run.observedFacts.stack.language}
- **Package Manager:** ${run.observedFacts.stack.packageManager || 'Unknown'}
- **Frameworks:** ${run.observedFacts.stack.frameworks.join(', ') || 'None detected'}
- **Tools:** ${run.observedFacts.stack.tools.join(', ') || 'None detected'}

## Recommendations
${run.recommendations.length > 0 
  ? run.recommendations.map(rec => `### [${rec.priority.toUpperCase()}] ${rec.description}
- **Category:** ${rec.category}
- **Rationale:** ${rec.rationale}
${rec.suggestedAction ? `- **Suggested Action:** ${rec.suggestedAction}` : ''}`).join('\n\n')
  : 'No recommendations at this time.'
}

---
*For more details, see [latest.json](./latest.json) or historical runs in [runs/](./runs/)*
`;

  await writeFile(summaryPath, content, 'utf-8');
  return summaryPath;
}
