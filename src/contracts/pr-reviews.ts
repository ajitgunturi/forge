import { GitHubRepositoryRef } from './discussions.js';

export interface PRReviewFilters {
  when?: 'today' | 'yesterday' | 'last-week';
  after?: string;
  before?: string;
  pr?: number;
  reviewer?: string;
  dateField: 'createdAt' | 'updatedAt';
  limit: number;
}

export interface PRReviewComment {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  updatedAt: string;
  path?: string;
  line?: number;
  side?: string;
  diffHunk?: string;
  inReplyToId?: string;
  url: string;
}

export interface PRRecord {
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed' | 'merged' | 'draft';
  author: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string | null;
  labels: string[];
  bodyText: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  reviewComments: PRReviewComment[];
  issueComments: PRReviewComment[];
}

export interface PRReviewRun {
  version: '1.0';
  id: string;
  timestamp: string;
  repository: GitHubRepositoryRef;
  filters: PRReviewFilters;
  pr: PRRecord;
  totalComments: number;
}

export type CommentCategory =
  | 'bug'
  | 'style'
  | 'performance'
  | 'security'
  | 'logic'
  | 'naming'
  | 'refactor'
  | 'documentation'
  | 'testing'
  | 'nitpick'
  | 'question'
  | 'approval'
  | 'general';

export interface PreparedComment {
  id: string;
  author: string;
  body: string;
  path?: string;
  line?: number;
  diffHunk?: string;
  createdAt: string;
  category: CommentCategory;
  severity: 'critical' | 'major' | 'minor' | 'informational';
  suggestedFix?: string;
  searchableText: string;
}

export interface PreparedPRReviewDigest {
  version: '1.0';
  id: string;
  sourceRunId: string;
  timestamp: string;
  repository: GitHubRepositoryRef;
  filters: PRReviewFilters;
  pr: {
    number: number;
    title: string;
    url: string;
    state: string;
    author: string;
    branch: string;
    baseBranch: string;
    additions: number;
    deletions: number;
    changedFiles: number;
  };
  totals: {
    comments: number;
    categories: Record<string, number>;
    severities: Record<string, number>;
    reviewers: Record<string, number>;
    filesCommented: Record<string, number>;
  };
  comments: PreparedComment[];
}

export interface PRReviewSummaryArtifact {
  version: '1.0';
  id: string;
  timestamp: string;
  question: string;
  repository: GitHubRepositoryRef;
  sourceRunId: string;
  source: 'live-fetch';
  filters: {
    pr?: number;
    reviewer?: string;
    after?: string;
    before?: string;
    dateField?: 'createdAt' | 'updatedAt';
  };
  prNumber: number;
  commentCount: number;
  categoryBreakdown: Record<string, number>;
  severityBreakdown: Record<string, number>;
  answer: string;
}
