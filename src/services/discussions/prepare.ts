import {
  DiscussionKind,
  DiscussionRun,
  DiscussionStatus,
  PreparedDiscussionDigest,
  PreparedDiscussionRecord,
} from '../../contracts/discussions.js';

export function buildPreparedDiscussionDigest(run: DiscussionRun): PreparedDiscussionDigest {
  const records = run.discussions.map((discussion) => buildPreparedRecord(discussion));

  return {
    version: '1.0',
    id: `${run.id}-analysis`,
    sourceRunId: run.id,
    timestamp: new Date().toISOString(),
    repository: run.repository,
    filters: run.filters,
    totals: {
      discussions: records.length,
      statuses: countBy(records.map((record) => record.status)),
      kinds: countBy(records.map((record) => record.kind)),
      categories: countBy(records.map((record) => record.category)),
    },
    records,
  };
}

function buildPreparedRecord(discussion: DiscussionRun['discussions'][number]): PreparedDiscussionRecord {
  const searchableText = buildSearchableText(discussion);
  const kind = classifyDiscussionKind(discussion.title, discussion.category.name, searchableText);
  const status = classifyDiscussionStatus(searchableText, discussion.answerChosenAt, discussion.commentsCount);

  return {
    number: discussion.number,
    title: discussion.title,
    url: discussion.url,
    category: discussion.category.name,
    categorySlug: discussion.category.slug,
    createdAt: discussion.createdAt,
    status,
    kind,
    issue: truncateSentence(searchableText, 220),
    resolution: inferResolution(status, searchableText),
    keyContext: extractKeyContext(searchableText),
    actionItems: inferActionItems(status, kind),
    teamMentions: extractTeamMentions(searchableText),
    searchableText,
    updatedAt: discussion.updatedAt,
  };
}

function classifyDiscussionKind(title: string, category: string, body: string): DiscussionKind {
  const haystack = `${title} ${category} ${body}`.toLowerCase();
  if (haystack.includes('incident') || haystack.includes('outage')) return 'incident';
  if (haystack.includes('feature') || haystack.includes('idea') || haystack.includes('request')) return 'feature-request';
  if (haystack.includes('config') || haystack.includes('setup') || haystack.includes('environment')) return 'configuration';
  if (haystack.includes('doc') || haystack.includes('documentation')) return 'documentation';
  if (haystack.includes('bug') || haystack.includes('error') || haystack.includes('fail')) return 'bug';
  if (haystack.includes('how do') || haystack.includes('question') || category.toLowerCase().includes('q&a')) return 'q-and-a';
  return 'consultation';
}

function classifyDiscussionStatus(body: string, answerChosenAt?: string | null, commentsCount = 0): DiscussionStatus {
  const haystack = body.toLowerCase();
  if (answerChosenAt) return 'resolved';
  if (haystack.includes('workaround')) return 'workaround-available';
  if (haystack.includes('blocked') || haystack.includes('waiting on')) return 'blocked';
  if (haystack.includes('expected behavior') || haystack.includes('not a bug')) return 'closed-not-a-bug';
  if (commentsCount <= 1) return 'unresolved';
  return 'answered';
}

function inferResolution(status: DiscussionStatus, body: string): string {
  switch (status) {
    case 'resolved':
      return 'A concrete resolution or accepted answer is available in the discussion.';
    case 'workaround-available':
      return 'A workaround is referenced, but the root issue may still require follow-up.';
    case 'blocked':
      return 'The discussion appears blocked on an external dependency or pending action.';
    case 'closed-not-a-bug':
      return 'The behavior is treated as expected rather than a product defect.';
    case 'answered':
      return 'The thread appears answered, even if no formal accepted answer is present.';
    default:
      return truncateSentence(normalizeWhitespace(body), 180) || 'No clear resolution is recorded yet.';
  }
}

function extractKeyContext(body: string): string[] {
  return normalizeWhitespace(body)
    .split('.')
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function buildSearchableText(discussion: DiscussionRun['discussions'][number]): string {
  const segments = [
    discussion.title,
    discussion.category.name,
    discussion.bodyText,
    ...discussion.comments.map((comment) => comment.bodyText),
  ];

  return normalizeWhitespace(segments.filter(Boolean).join('. '));
}

function extractTeamMentions(body: string): string[] {
  const matches = body.toLowerCase().match(/@[a-z0-9][a-z0-9-_]*/g) ?? [];
  return [...new Set(matches)];
}

function inferActionItems(status: DiscussionStatus, kind: DiscussionKind): string[] {
  if (status === 'unresolved') {
    return ['Confirm current owner', 'Decide next investigation step'];
  }
  if (status === 'blocked') {
    return ['Track blocker owner', 'Revisit after dependency clears'];
  }
  if (kind === 'documentation') {
    return ['Consider documentation update'];
  }
  return ['No immediate action required'];
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateSentence(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}
