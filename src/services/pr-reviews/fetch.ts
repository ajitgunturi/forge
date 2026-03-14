import { PRReviewFilters, PRRecord, PRReviewComment } from '../../contracts/pr-reviews.js';
import { GitHubRepositoryRef } from '../../contracts/discussions.js';
import { UserFacingError } from '../../lib/errors.js';
import { matchesPRReviewWindow } from './filters.js';

export class GitHubPRFetchError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubPRFetchError';
  }
}

export interface FetchGitHubPROptions {
  repository: GitHubRepositoryRef;
  token: string;
  filters: PRReviewFilters;
}

export interface FetchGitHubPRResult {
  pr: PRRecord;
}

interface GitHubPRApiRecord {
  number: number;
  title: string;
  html_url: string;
  state: 'open' | 'closed';
  draft: boolean;
  merged_at?: string | null;
  user?: { login?: string | null } | null;
  head?: { ref?: string | null } | null;
  base?: { ref?: string | null } | null;
  created_at: string;
  updated_at: string;
  labels: Array<{ name?: string | null }>;
  body?: string | null;
  additions: number;
  deletions: number;
  changed_files: number;
}

interface GitHubReviewCommentApiRecord {
  id: number;
  body?: string | null;
  user?: { login?: string | null } | null;
  created_at: string;
  updated_at: string;
  path?: string | null;
  line?: number | null;
  original_line?: number | null;
  side?: string | null;
  diff_hunk?: string | null;
  in_reply_to_id?: number | null;
  html_url: string;
}

interface GitHubIssueCommentApiRecord {
  id: number;
  body?: string | null;
  user?: { login?: string | null } | null;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export async function fetchGitHubPR(
  options: FetchGitHubPROptions,
): Promise<FetchGitHubPRResult> {
  if (!options.filters.pr) {
    throw new GitHubPRFetchError('A PR number is required to fetch PR review comments.');
  }

  const prNumber = options.filters.pr;
  const { owner, name } = options.repository;
  const headers = {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${options.token}`,
  };

  const prResponse = await fetch(
    `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}`,
    { headers },
  );

  if (!prResponse.ok) {
    throw new GitHubPRFetchError(await buildFetchErrorMessage(prResponse, `PR #${prNumber}`));
  }

  const prData = (await prResponse.json()) as GitHubPRApiRecord;

  const reviewComments = await fetchAllPages<GitHubReviewCommentApiRecord>(
    `https://api.github.com/repos/${owner}/${name}/pulls/${prNumber}/comments`,
    headers,
    options.filters.limit,
  );

  const issueComments = await fetchAllPages<GitHubIssueCommentApiRecord>(
    `https://api.github.com/repos/${owner}/${name}/issues/${prNumber}/comments`,
    headers,
    options.filters.limit,
  );

  const normalizedReviewComments = reviewComments
    .map((comment): PRReviewComment => ({
      id: String(comment.id),
      body: comment.body ?? '',
      author: comment.user?.login ?? 'unknown',
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      path: comment.path ?? undefined,
      line: comment.line ?? comment.original_line ?? undefined,
      side: comment.side ?? undefined,
      diffHunk: comment.diff_hunk ?? undefined,
      inReplyToId: comment.in_reply_to_id ? String(comment.in_reply_to_id) : undefined,
      url: comment.html_url,
    }))
    .filter((comment) => filterByReviewer(comment, options.filters.reviewer))
    .filter((comment) => matchesPRReviewWindow(comment.createdAt, options.filters));

  const normalizedIssueComments = issueComments
    .map((comment): PRReviewComment => ({
      id: String(comment.id),
      body: comment.body ?? '',
      author: comment.user?.login ?? 'unknown',
      createdAt: comment.created_at,
      updatedAt: comment.updated_at,
      url: comment.html_url,
    }))
    .filter((comment) => filterByReviewer(comment, options.filters.reviewer))
    .filter((comment) => matchesPRReviewWindow(comment.createdAt, options.filters));

  const prState = prData.merged_at
    ? 'merged'
    : prData.draft
      ? 'draft'
      : prData.state;

  const pr: PRRecord = {
    number: prData.number,
    title: prData.title,
    url: prData.html_url,
    state: prState as PRRecord['state'],
    author: prData.user?.login ?? 'unknown',
    branch: prData.head?.ref ?? 'unknown',
    baseBranch: prData.base?.ref ?? 'unknown',
    createdAt: prData.created_at,
    updatedAt: prData.updated_at,
    mergedAt: prData.merged_at ?? null,
    labels: prData.labels.map((label) => label.name?.trim()).filter((value): value is string => Boolean(value)),
    bodyText: prData.body ?? '',
    additions: prData.additions,
    deletions: prData.deletions,
    changedFiles: prData.changed_files,
    reviewComments: normalizedReviewComments,
    issueComments: normalizedIssueComments,
  };

  return { pr };
}

async function fetchAllPages<T>(
  baseUrl: string,
  headers: Record<string, string>,
  limit: number,
): Promise<T[]> {
  const collected: T[] = [];
  let page = 1;
  let hasNextPage = true;
  const pageSize = 100;

  while (hasNextPage && collected.length < limit) {
    const params = new URLSearchParams({
      per_page: String(pageSize),
      page: String(page),
    });
    const response = await fetch(`${baseUrl}?${params.toString()}`, { headers });

    if (!response.ok) {
      break;
    }

    const data = (await response.json()) as T[];
    collected.push(...data);

    hasNextPage = data.length === pageSize;
    page += 1;
  }

  return collected.slice(0, limit);
}

function filterByReviewer(comment: PRReviewComment, reviewer?: string): boolean {
  if (!reviewer) {
    return true;
  }
  return comment.author.toLowerCase() === reviewer.toLowerCase();
}

async function buildFetchErrorMessage(response: Response, context: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as { message?: string } | null;

  if (payload?.message) {
    return `GitHub API error fetching ${context}: ${payload.message}`;
  }

  return `GitHub API request failed for ${context} (${response.status}).`;
}
