import { GitHubRepositoryRef } from '../../contracts/discussions.js';
import { UserFacingError } from '../../lib/errors.js';
import { git } from '../git.js';

/**
 * Resolves a PR number from the current branch by querying GitHub for
 * open PRs whose head branch matches the current git branch.
 *
 * Falls back to an error if no PR is found.
 */
export async function resolvePRNumber(
  repository: GitHubRepositoryRef,
  token: string,
): Promise<number> {
  const branch = await git.getBranch();

  if (branch === 'unknown' || branch === 'HEAD') {
    throw new UserFacingError(
      'Cannot detect a PR from a detached HEAD. Provide a PR number with --pr <number>.',
    );
  }

  const params = new URLSearchParams({
    head: `${repository.owner}:${branch}`,
    state: 'all',
    per_page: '1',
    sort: 'updated',
    direction: 'desc',
  });

  const response = await fetch(
    `https://api.github.com/repos/${repository.owner}/${repository.name}/pulls?${params.toString()}`,
    {
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    throw new UserFacingError(
      `Failed to look up PR for branch "${branch}". Provide a PR number with --pr <number>.`,
    );
  }

  const prs = (await response.json()) as Array<{ number: number }>;

  if (prs.length === 0) {
    throw new UserFacingError(
      `No PR found for branch "${branch}". Provide a PR number with --pr <number>.`,
    );
  }

  return prs[0]!.number;
}
