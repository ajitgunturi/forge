import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runPlanningFlow } from '../../../src/services/planning/run.js';
import { loadLatestAnalysis } from '../../../src/services/analysis/artifacts.js';
import { persistPlanRun } from '../../../src/services/planning/artifacts.js';
import { SidecarContext } from '../../../src/services/sidecar.js';
import { AnalysisRequiredError } from '../../../src/lib/errors.js';
import { AnalysisRun } from '../../../src/contracts/analysis.js';

vi.mock('../../../src/services/analysis/artifacts.js');
vi.mock('../../../src/services/planning/artifacts.js');

describe('runPlanningFlow', () => {
  const mockContext: SidecarContext = {
    repoRoot: '/fake/repo',
    sidecarPath: '/fake/repo/.forge',
    metadataPath: '/fake/repo/.forge/metadata.json',
    config: { sidecarDir: '.forge' },
  } as any;

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
      stack: { language: 'typescript', frameworks: [], tools: [] },
      structure: { directories: [], criticalFiles: [], entryPoints: [] },
      assistantContext: { hasInstructions: false, hasCustomSkills: false, availableSkills: [] },
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
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully runs the planning flow', async () => {
    vi.mocked(loadLatestAnalysis).mockResolvedValue(mockAnalysis);
    vi.mocked(persistPlanRun).mockResolvedValue({
      id: 'plan-123',
      timestamp: '2023-10-27T10:00:00.000Z',
      analysisRunId: mockAnalysis.id,
      artifactPath: '.forge/planning/runs/plan-123.json',
    });

    const result = await runPlanningFlow(mockContext, { task: 'Test Task' });

    expect(loadLatestAnalysis).toHaveBeenCalledWith(mockContext);
    expect(persistPlanRun).toHaveBeenCalled();
    expect(result.id).toBe('plan-123');
    expect(result.analysisRunId).toBe(mockAnalysis.id);
  });

  it('throws AnalysisRequiredError if no analysis is found', async () => {
    vi.mocked(loadLatestAnalysis).mockResolvedValue(null);

    await expect(runPlanningFlow(mockContext))
      .rejects.toThrow(AnalysisRequiredError);
    
    expect(persistPlanRun).not.toHaveBeenCalled();
  });

  it('passes invocation context to the generator', async () => {
    vi.mocked(loadLatestAnalysis).mockResolvedValue(mockAnalysis);
    vi.mocked(persistPlanRun).mockResolvedValue({} as any);

    const invocation = { task: 'Custom Task', discussionId: 'disc-1' };
    await runPlanningFlow(mockContext, invocation);

    // Verify that persistPlanRun was called with a plan that has the invocation context
    const calledPlan = vi.mocked(persistPlanRun).mock.calls[0][1];
    expect(calledPlan.metadata.invocation).toEqual(invocation);
    expect(calledPlan.title).toBe('Plan: Custom Task');
  });
});
