import { PRReviewRun } from '../../contracts/pr-reviews.js';
import { git } from '../git.js';
import { resolveGitHubToken } from '../discussions/auth.js';
import { normalizePRReviewFilters } from './filters.js';
import { fetchGitHubPR } from './fetch.js';
import { resolvePRNumber } from './resolve-pr.js';

export interface RunPRReviewFetchOptions {
  cwd: string;
  token?: string;
  when?: string;
  after?: string;
  before?: string;
  pr?: number;
  reviewer?: string;
  dateField?: 'createdAt' | 'updatedAt';
  limit?: number;
}

export async function runPRReviewFetch(options: RunPRReviewFetchOptions): Promise<PRReviewRun> {
  process.chdir(options.cwd);

  await git.getRepoRoot();
  const repository = await git.getGitHubRepository();
  const token = resolveGitHubToken({ explicitToken: options.token });

  const prNumber = options.pr ?? await resolvePRNumber(repository, token);

  const filters = normalizePRReviewFilters({
    when: options.when,
    after: options.after,
    before: options.before,
    pr: prNumber,
    reviewer: options.reviewer,
    dateField: options.dateField,
    limit: options.limit,
  });

  const fetched = await fetchGitHubPR({
    repository,
    token,
    filters,
  });

  const run: PRReviewRun = {
    version: '1.0',
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    timestamp: new Date().toISOString(),
    repository,
    filters,
    pr: fetched.pr,
    totalComments: fetched.pr.reviewComments.length + fetched.pr.issueComments.length,
  };

  return run;
}
