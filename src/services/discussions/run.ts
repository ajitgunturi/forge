import { DiscussionRun } from '../../contracts/discussions.js';
import { git } from '../git.js';
import { resolveGitHubToken } from './auth.js';
import { normalizeDiscussionFilters } from './filters.js';
import { fetchGitHubDiscussions } from './fetch.js';

export interface RunDiscussionFetchOptions {
  cwd: string;
  token?: string;
  when?: string;
  after?: string;
  before?: string;
  category?: string;
  dateField?: 'createdAt' | 'updatedAt';
  limit?: number;
}

export async function runDiscussionFetch(options: RunDiscussionFetchOptions): Promise<DiscussionRun> {
  process.chdir(options.cwd);

  await git.getRepoRoot();
  const repository = await git.getGitHubRepository();
  const token = resolveGitHubToken({ explicitToken: options.token });
  const filters = normalizeDiscussionFilters({
    when: options.when,
    after: options.after,
    before: options.before,
    category: options.category,
    dateField: options.dateField,
    limit: options.limit,
  });

  const fetched = await fetchGitHubDiscussions({
    repository,
    token,
    filters,
  });

  if (fetched.resolvedCategory) {
    filters.resolvedCategory = fetched.resolvedCategory;
  }

  const run: DiscussionRun = {
    version: '1.0',
    id: new Date().toISOString().replace(/[:.]/g, '-'),
    timestamp: new Date().toISOString(),
    repository,
    filters,
    pageInfo: fetched.pageInfo,
    discussionCount: fetched.discussions.length,
    discussions: fetched.discussions,
  };

  return run;
}
