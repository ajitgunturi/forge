export interface GitHubRepositoryRef {
  owner: string;
  name: string;
  remoteUrl: string;
}

export interface DiscussionCategory {
  id: string;
  name: string;
  slug: string;
}

export interface DiscussionFilters {
  when?: 'today' | 'yesterday' | 'last-week';
  after?: string;
  before?: string;
  category?: string;
  resolvedCategory?: DiscussionCategory;
  dateField: 'createdAt' | 'updatedAt';
  limit: number;
}

export interface DiscussionCommentRecord {
  body?: string;
  bodyText: string;
  author?: string;
  createdAt: string;
}

export interface DiscussionRecord {
  id: string;
  number: number;
  title: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  answerChosenAt?: string | null;
  author?: string;
  category: DiscussionCategory;
  bodyText: string;
  commentsCount: number;
  comments: DiscussionCommentRecord[];
  upvoteCount: number;
}

export interface DiscussionRun {
  version: '1.0';
  id: string;
  timestamp: string;
  repository: GitHubRepositoryRef;
  filters: DiscussionFilters;
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
    fetchedPages: number;
  };
  discussionCount: number;
  discussions: DiscussionRecord[];
}

export interface DiscussionRunSummary {
  id: string;
  timestamp: string;
  repository: string;
  discussionCount: number;
  artifactPath: string;
  filterDescription?: string;
}

export type DiscussionStatus =
  | 'resolved'
  | 'unresolved'
  | 'workaround-available'
  | 'blocked'
  | 'answered'
  | 'closed-not-a-bug';

export type DiscussionKind =
  | 'bug'
  | 'configuration'
  | 'feature-request'
  | 'q-and-a'
  | 'documentation'
  | 'incident'
  | 'consultation';

export interface PreparedDiscussionRecord {
  number: number;
  title: string;
  url: string;
  category: string;
  categorySlug: string;
  createdAt: string;
  status: DiscussionStatus;
  kind: DiscussionKind;
  issue: string;
  resolution: string;
  keyContext: string[];
  actionItems: string[];
  teamMentions: string[];
  searchableText: string;
  updatedAt: string;
}

export interface PreparedDiscussionDigest {
  version: '1.0';
  id: string;
  sourceRunId: string;
  timestamp: string;
  repository: GitHubRepositoryRef;
  filters: DiscussionFilters;
  totals: {
    discussions: number;
    statuses: Record<string, number>;
    kinds: Record<string, number>;
    categories: Record<string, number>;
  };
  records: PreparedDiscussionRecord[];
}

export interface DiscussionAnalysisTrace {
  version: '1.0';
  id: string;
  timestamp: string;
  question: string;
  repository: GitHubRepositoryRef;
  digestId: string;
  sourceRunId: string;
  decision: {
    refreshUsed: boolean;
    refreshReason: string;
    source: 'explicit-refresh' | 'implicit-refresh' | 'cached-digest' | 'rebuild-latest-run';
      parsedFilters: {
        when?: string;
        after?: string;
        before?: string;
        category?: string;
        dateField?: 'createdAt' | 'updatedAt';
      };
    };
  answer: string;
  digest: PreparedDiscussionDigest;
}
