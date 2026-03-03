import { DiscussionFilters } from '../../contracts/discussions.js';
import { normalizeDiscussionFilters } from './filters.js';

export interface DiscussionAnalyzerIntentOptions {
  question: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  when?: string;
  after?: string;
  before?: string;
  category?: string;
  limit?: number;
  preferredCategory?: {
    name: string;
    slug: string;
  };
}

export interface DiscussionAnalyzerIntent {
  question: string;
  normalizedQuestion: string;
  scope: 'discussions' | 'issues';
  refreshMode: 'fetch' | 'rebuild' | 'cached';
  refreshReason:
    | 'explicit-force-refresh'
    | 'explicit-refresh-analysis'
    | 'current-status-question'
    | 'time-scoped-question'
    | 'cached-local-question';
  parsedFilters: DiscussionFilters;
  temporalField: 'createdAt' | 'updatedAt';
  answerShape: {
    wantsCounts: boolean;
    wantsPatterns: boolean;
    wantsEffectiveness: boolean;
    wantsCategoryHealth: boolean;
  };
  redirectQuestion?: string;
  categorySource?: 'explicit' | 'preferred';
}

export function analyzeDiscussionRequestIntent(
  options: DiscussionAnalyzerIntentOptions,
): DiscussionAnalyzerIntent {
  const question = options.question.trim();
  const normalizedQuestion = question.toLowerCase();
  const scope = detectScope(normalizedQuestion);

  const extractedFilters = extractQuestionFilters(question, normalizedQuestion);
  const temporalField = detectTemporalField(normalizedQuestion, extractedFilters);
  const chosenCategory = options.category ?? extractedFilters.category ?? getPreferredCategoryForQuestion(
    normalizedQuestion,
    options.preferredCategory,
  );
  const parsedFilters = normalizeDiscussionFilters({
    when: options.when ?? extractedFilters.when,
    after: options.after ?? extractedFilters.after,
    before: options.before ?? extractedFilters.before,
    category: chosenCategory,
    dateField: temporalField,
    limit: options.limit,
  });

  const refreshReason = resolveRefreshReason({
    normalizedQuestion,
    forceRefresh: options.forceRefresh,
    refreshAnalysis: options.refreshAnalysis,
    filters: parsedFilters,
  });

  return {
    question,
    normalizedQuestion,
    scope,
    refreshMode: refreshReasonToMode(refreshReason),
    refreshReason,
    parsedFilters,
    temporalField,
    answerShape: {
      wantsCounts: /\b(count|how many|number of|total)\b/.test(normalizedQuestion),
      wantsPatterns: ['pattern', 'trend', 'common', 'theme', 'recurring', 'gap', 'gaps'].some((keyword) =>
        normalizedQuestion.includes(keyword),
      ),
      wantsEffectiveness: ['effectiveness', 'support quality', 'response time', 'sla', 'performance'].some(
        (keyword) => normalizedQuestion.includes(keyword),
      ),
      wantsCategoryHealth: hasCurrentStatusIntent(normalizedQuestion) && Boolean(parsedFilters.category),
    },
    redirectQuestion: scope === 'issues' ? question.replace(/\bissues?\b/gi, 'discussions') : undefined,
    categorySource: options.category || extractedFilters.category ? 'explicit' : chosenCategory ? 'preferred' : undefined,
  };
}

function detectScope(normalizedQuestion: string): 'discussions' | 'issues' {
  const mentionsIssues = /\bissues?\b/.test(normalizedQuestion);
  const mentionsDiscussions = /\bdiscussions?\b/.test(normalizedQuestion);
  if (mentionsIssues && !mentionsDiscussions) {
    return 'issues';
  }
  return 'discussions';
}

function detectTemporalField(
  normalizedQuestion: string,
  extractedFilters: { when?: string; after?: string; before?: string; category?: string },
): 'createdAt' | 'updatedAt' {
  if (/\b(updated|activity|active|recent activity)\b/.test(normalizedQuestion)) {
    return 'updatedAt';
  }

  if (/\b(created|opened|open)\b/.test(normalizedQuestion)) {
    return 'createdAt';
  }

  if (extractedFilters.when || extractedFilters.after || extractedFilters.before) {
    return 'createdAt';
  }

  return 'updatedAt';
}

function resolveRefreshReason(input: {
  normalizedQuestion: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  filters: DiscussionFilters;
}): DiscussionAnalyzerIntent['refreshReason'] {
  if (input.forceRefresh) {
    return 'explicit-force-refresh';
  }
  if (input.refreshAnalysis) {
    return 'explicit-refresh-analysis';
  }
  if (hasCurrentStatusIntent(input.normalizedQuestion)) {
    return 'current-status-question';
  }
  if (hasExplicitTimeScope(input.normalizedQuestion, input.filters)) {
    return 'time-scoped-question';
  }
  return 'cached-local-question';
}

function refreshReasonToMode(
  reason: DiscussionAnalyzerIntent['refreshReason'],
): DiscussionAnalyzerIntent['refreshMode'] {
  if (reason === 'explicit-refresh-analysis') {
    return 'rebuild';
  }
  if (reason === 'cached-local-question') {
    return 'cached';
  }
  return 'fetch';
}

function hasCurrentStatusIntent(normalizedQuestion: string): boolean {
  if (/\b(current status|latest status|current state|latest state|up to date)\b/.test(normalizedQuestion)) {
    return true;
  }

  if (/\bhow\s+is\s+.+\s+looking\b/.test(normalizedQuestion) || /\bhow\s+are\s+.+\s+looking\b/.test(normalizedQuestion)) {
    return true;
  }

  if (/\bhow\s+(?:is|are)\s+.+\s+(?:doing|going|performing)\b/.test(normalizedQuestion)) {
    return true;
  }

  const currentnessWord = /\b(current|latest|fresh)\b/.test(normalizedQuestion);
  const statusWord = /\b(status|state|standing|situation|update|updates)\b/.test(normalizedQuestion);
  return currentnessWord && statusWord;
}

function hasExplicitTimeScope(normalizedQuestion: string, filters: DiscussionFilters): boolean {
  if (filters.when || filters.after || filters.before) {
    return true;
  }

  return (
    /\bbetween\b/.test(normalizedQuestion) ||
    /\b(since|after|before|from|during)\b/.test(normalizedQuestion) ||
    /\b(today|yesterday|last week|last-week)\b/.test(normalizedQuestion)
  );
}

function extractQuestionFilters(
  question: string,
  normalizedQuestion: string,
): { when?: string; after?: string; before?: string; category?: string } {
  const when = extractRelativeWindow(normalizedQuestion);
  const between = extractBetweenRange(question);
  return {
    when,
    after:
      between?.after ??
      extractSingleDate(question, 'since') ??
      extractSingleDate(question, 'after') ??
      extractSingleDate(question, 'from'),
    before: between?.before ?? extractSingleDate(question, 'before'),
    category: extractCategory(question),
  };
}

function extractRelativeWindow(normalizedQuestion: string): string | undefined {
  if (/\btoday\b/.test(normalizedQuestion)) return 'today';
  if (/\byesterday\b/.test(normalizedQuestion)) return 'yesterday';
  if (/\b(?:last week|last-week|last_week|last 1 week|in the last week|in the last 1 week|past week|past 1 week|last 7 days|past 7 days)\b/.test(normalizedQuestion)) {
    return 'last-week';
  }
  return undefined;
}

function extractBetweenRange(question: string): { after?: string; before?: string } | null {
  const match = question.match(/\bbetween\s+(.+?)\s+and\s+(.+?)(?:[?.!,]|$)/i);
  if (!match) {
    return null;
  }

  const after = normalizeDatePhrase(match[1]);
  const before = normalizeDatePhrase(match[2]);
  if (!after && !before) {
    return null;
  }

  return { after: after ?? undefined, before: before ?? undefined };
}

function extractSingleDate(question: string, keyword: 'since' | 'after' | 'before' | 'from'): string | undefined {
  const regex = new RegExp(
    `\\b${keyword}\\s+(.+?)(?=\\b(?:and|in the|under the|under|category|created|updated|status|state|issues?|discussions?)\\b|[?.!,]|$)`,
    'i',
  );
  const match = question.match(regex);
  if (!match) {
    return undefined;
  }

  return normalizeDatePhrase(match[1]) ?? undefined;
}

function normalizeDatePhrase(raw: string): string | null {
  const trimmed = raw
    .trim()
    .replace(/^on\s+/i, '')
    .replace(/\s+\b(?:in|under)\s+(?:the\s+)?(.+?)\s+category\b.*$/i, '');
  if (!trimmed) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}(?:[ t]\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:z|[+-]\d{2}:\d{2})?)?$/i.test(trimmed)) {
    return trimmed.replace(' ', 'T');
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function extractCategory(question: string): string | undefined {
  const match = question.match(/\b(?:in|under)\s+(?:the\s+)?(.+?)\s+category\b/i);
  if (match?.[1]?.trim()) {
    return match[1].trim();
  }

  const statusMatch = question.match(/\bhow\s+is\s+(.+?)\s+looking\b/i);
  if (isSpecificCategoryCandidate(statusMatch?.[1])) {
    return statusMatch[1].trim();
  }

  const doingMatch = question.match(/\bhow\s+(?:is|are)\s+(.+?)\s+(?:doing|going|performing)\b/i);
  if (isSpecificCategoryCandidate(doingMatch?.[1])) {
    return doingMatch[1].trim();
  }

  const lookingLikeMatch = question.match(/\bwhat(?:'s| is)\s+(.+?)\s+looking\s+like\b/i);
  if (isSpecificCategoryCandidate(lookingLikeMatch?.[1])) {
    return lookingLikeMatch[1].trim();
  }

  const statusOfMatch = question.match(/\bstatus\s+of\s+(.+?)(?:\s+discussions?)?(?:[?.!,]|$)/i);
  if (isSpecificCategoryCandidate(statusOfMatch?.[1])) {
    return statusOfMatch[1].trim();
  }

  return undefined;
}

function getPreferredCategoryForQuestion(
  normalizedQuestion: string,
  preferredCategory?: { name: string; slug: string },
): string | undefined {
  if (!preferredCategory) {
    return undefined;
  }

  if (!hasCurrentStatusIntent(normalizedQuestion)) {
    return undefined;
  }

  return preferredCategory.slug;
}

function isSpecificCategoryCandidate(value?: string): value is string {
  const trimmed = value?.trim().toLowerCase();
  if (!trimmed) {
    return false;
  }

  return !['it', 'them', 'this', 'that'].includes(trimmed);
}
