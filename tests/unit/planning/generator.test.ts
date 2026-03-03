import { describe, it, expect } from 'vitest';
import { PlanningGenerator } from '../../../src/services/planning/generator.js';
import { AnalysisRun } from '../../../src/contracts/analysis.js';

describe('PlanningGenerator', () => {
  const generator = new PlanningGenerator();

  const mockAnalysis: AnalysisRun = {
    version: '1.0',
    id: '2023-10-27T10-00-00-000Z',
    timestamp: '2023-10-27T10:00:00.000Z',
    observedFacts: {
      repository: {
        name: 'test-repo',
        branch: 'main',
        commitHash: 'abc123456',
      },
      stack: {
        language: 'typescript',
        frameworks: [],
        tools: [],
      },
      structure: {
        directories: [],
        criticalFiles: [],
        entryPoints: [],
      },
      assistantContext: {
        hasInstructions: false,
        hasCustomSkills: false,
        instructionsPath: undefined,
        availableSkills: [],
      },
      rawFindings: {},
    },
    recommendations: [
      {
        id: 'REC-STACK-01',
        category: 'architecture',
        priority: 'high',
        description: 'Missing typescript dependency',
        rationale: 'The project is written in TypeScript but typescript is not in devDependencies.',
      },
      {
        id: 'REC-ASST-01',
        category: 'convention',
        priority: 'medium',
        description: 'Missing assistant instructions',
        rationale: 'CLAUDE.md is missing.',
      },
      {
        id: 'REC-GENERIC-01',
        category: 'implementation',
        priority: 'low',
        description: 'Test generic recommendation',
        rationale: 'This is a test.',
        suggestedAction: 'Run some-command --force',
      },
    ],
  };

  it('generates a plan run from an analysis run', () => {
    const plan = generator.generate(mockAnalysis);

    expect(plan.version).toBe('1.0');
    expect(plan.analysisRunId).toBe(mockAnalysis.id);
    expect(plan.actions.length).toBe(3);

    // Check specific mapped actions
    const stackAction = plan.actions.find(a => a.recommendationIds.includes('REC-STACK-01'));
    expect(stackAction).toBeDefined();
    expect(stackAction?.type).toBe('dependency-add');
    expect(stackAction?.title).toContain('typescript');

    const asstAction = plan.actions.find(a => a.recommendationIds.includes('REC-ASST-01'));
    expect(asstAction).toBeDefined();
    expect(asstAction?.type).toBe('file-create');
    expect(asstAction?.files).toContain('CLAUDE.md');

    const genericAction = plan.actions.find(a => a.recommendationIds.includes('REC-GENERIC-01'));
    expect(genericAction).toBeDefined();
    expect(genericAction?.type).toBe('command-run');
    expect(genericAction?.description).toBe('Run some-command --force');
  });

  it('incorporates invocation context into the plan', () => {
    const invocation = { task: 'Fix authentication', discussionId: '123' };
    const plan = generator.generate(mockAnalysis, invocation);

    expect(plan.title).toBe('Plan: Fix authentication');
    expect(plan.objective).toContain('Fix authentication');
    expect(plan.metadata.invocation).toEqual(invocation);
  });

  it('includes default assumptions and evidence references', () => {
    const plan = generator.generate(mockAnalysis);

    expect(plan.assumptions.length).toBeGreaterThan(0);
    expect(plan.metadata.evidenceReferences).toContain(`Analysis Run ID: ${mockAnalysis.id}`);
    expect(plan.metadata.evidenceReferences).toContain(`Commit Hash: ${mockAnalysis.observedFacts.repository.commitHash}`);
  });
});
