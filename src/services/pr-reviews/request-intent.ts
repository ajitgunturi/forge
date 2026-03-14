export interface PRReviewIntentOptions {
  question: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  when?: string;
  after?: string;
  before?: string;
  pr?: number;
  reviewer?: string;
  limit?: number;
}

export interface PRReviewIntent {
  question: string;
  normalizedQuestion: string;
  scope: 'pr-reviews' | 'issues' | 'discussions';
  refreshMode: 'fetch';
  refreshReason:
    | 'explicit-force-refresh'
    | 'explicit-refresh-analysis'
    | 'current-status-question'
    | 'time-scoped-question'
    | 'default-live-query';
  parsedFilters: {
    when?: 'today' | 'yesterday' | 'last-week';
    after?: string;
    before?: string;
    pr?: number;
    reviewer?: string;
    dateField: 'createdAt' | 'updatedAt';
    limit: number;
  };
  temporalField: 'createdAt' | 'updatedAt';
  answerShape: {
    wantsCounts: boolean;
    wantsPatterns: boolean;
    wantsSurgicalFixes: boolean;
    wantsFileSummary: boolean;
  };
  redirectQuestion?: string;
}

export function analyzePRReviewRequestIntent(
  options: PRReviewIntentOptions,
): PRReviewIntent {
  const question = options.question.trim();
  const normalizedQuestion = question.toLowerCase();
  const scope = detectScope(normalizedQuestion);
  const extractedFilters = extractQuestionFilters(question, normalizedQuestion);

  const pr = options.pr ?? extractedFilters.pr;
  const reviewer = options.reviewer ?? extractedFilters.reviewer;
  const when = options.when ?? extractedFilters.when;
  const after = options.after ?? extractedFilters.after;
  const before = options.before ?? extractedFilters.before;
  const temporalField = detectTemporalField(normalizedQuestion, { after, before, when });

  const parsedFilters = {
    when: when as PRReviewIntent['parsedFilters']['when'],
    after,
    before,
    pr,
    reviewer,
    dateField: temporalField,
    limit: options.limit ?? 500,
  };

  return {
    question,
    normalizedQuestion,
    scope,
    refreshMode: 'fetch',
    refreshReason: resolveRefreshReason({
      normalizedQuestion,
      forceRefresh: options.forceRefresh,
      refreshAnalysis: options.refreshAnalysis,
      filters: parsedFilters,
    }),
    parsedFilters,
    temporalField,
    answerShape: {
      wantsCounts: /\b(count|how many|number of|total)\b/.test(normalizedQuestion),
      wantsPatterns: /\b(pattern|trend|common|theme|recurring|frequent|repeated)\b/.test(normalizedQuestion),
      wantsSurgicalFixes: /\b(fix|suggest|surgical|resolve|address|action|change|patch)\b/.test(normalizedQuestion),
      wantsFileSummary: /\b(file|path|by file|per file|which file)\b/.test(normalizedQuestion),
    },
    redirectQuestion: scope !== 'pr-reviews'
      ? question.replace(/\bissues?\b/gi, 'pull requests').replace(/\bdiscussions?\b/gi, 'pull requests')
      : undefined,
  };
}

function detectScope(normalizedQuestion: string): PRReviewIntent['scope'] {
  if (/\b(issues?|bug report|feature request)\b/.test(normalizedQuestion)) {
    return 'issues';
  }
  if (/\b(discussions?|forum|q\s*&\s*a)\b/.test(normalizedQuestion)) {
    return 'discussions';
  }
  return 'pr-reviews';
}

function detectTemporalField(
  normalizedQuestion: string,
  filters: { after?: string; before?: string; when?: string },
): 'createdAt' | 'updatedAt' {
  if (/\bupdated?\b/.test(normalizedQuestion)) {
    return 'updatedAt';
  }
  if (filters.after || filters.before || filters.when) {
    return 'createdAt';
  }
  return 'createdAt';
}

function resolveRefreshReason(input: {
  normalizedQuestion: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  filters: PRReviewIntent['parsedFilters'];
}): PRReviewIntent['refreshReason'] {
  if (input.forceRefresh) return 'explicit-force-refresh';
  if (input.refreshAnalysis) return 'explicit-refresh-analysis';
  if (/\b(current|right now|latest|status)\b/.test(input.normalizedQuestion)) return 'current-status-question';
  if (input.filters.when || input.filters.after || input.filters.before) return 'time-scoped-question';
  return 'default-live-query';
}

function extractQuestionFilters(
  question: string,
  normalizedQuestion: string,
): { pr?: number; reviewer?: string; when?: string; after?: string; before?: string } {
  const result: { pr?: number; reviewer?: string; when?: string; after?: string; before?: string } = {};

  const prMatch = normalizedQuestion.match(/(?:#|pr\s*|pull\s*request\s*)(\d+)/);
  if (prMatch) {
    result.pr = Number.parseInt(prMatch[1]!, 10);
  }

  const reviewerMatch = question.match(/(?:by|from|reviewer|author)\s+@?([a-zA-Z0-9][a-zA-Z0-9_-]*)/i);
  if (reviewerMatch) {
    result.reviewer = reviewerMatch[1]!;
  }

  const whenMatch = normalizedQuestion.match(/\b(today|yesterday|last[- _]?week)\b/);
  if (whenMatch) {
    result.when = whenMatch[1]!.replace(/[_ ]/g, '-');
  }

  return result;
}
