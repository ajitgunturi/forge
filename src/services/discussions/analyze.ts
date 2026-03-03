import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PreparedDiscussionDigest, DiscussionAnalysisTrace } from '../../contracts/discussions.js';
import { DiscussionArtifactsRequiredError, DiscussionsOnlyAnalyzerError } from '../../lib/errors.js';
import { deriveSidecarContext } from '../sidecar.js';
import { loadLatestPreparedDiscussionDigest, prepareLatestDiscussionDigest } from './prepare.js';
import { analyzeDiscussionRequestIntent, DiscussionAnalyzerIntent } from './request-intent.js';
import { loadPreferredDiscussionCategory, savePreferredDiscussionCategory } from './preferences.js';
import { runDiscussionFetch } from './run.js';

export interface RunDiscussionAnalyzerOptions {
  cwd: string;
  question: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  token?: string;
  when?: string;
  after?: string;
  before?: string;
  category?: string;
  limit?: number;
}

const DEFAULT_ANALYZER_REFRESH_LIMIT = 1000;

export async function runDiscussionAnalyzer(options: RunDiscussionAnalyzerOptions): Promise<string> {
  const preferredCategory = await loadPreferredDiscussionCategory(options.cwd);
  const intent = analyzeDiscussionRequestIntent({
    question: options.question,
    forceRefresh: options.forceRefresh,
    refreshAnalysis: options.refreshAnalysis,
    when: options.when,
    after: options.after,
    before: options.before,
    category: options.category,
    limit: options.limit,
    preferredCategory,
  });

  if (!intent.normalizedQuestion) {
    throw new DiscussionArtifactsRequiredError('A question is required when running forge-discussion-analyzer.');
  }
  assertDiscussionScopedQuestion(intent);

  const digest = await loadDigestForIntent(options, intent);
  const answer = renderAnswer(digest, intent);
  await persistAnalysisTrace(options.cwd, digest, intent, answer);
  return answer;
}

async function loadDigestForIntent(
  options: RunDiscussionAnalyzerOptions,
  intent: DiscussionAnalyzerIntent,
): Promise<PreparedDiscussionDigest> {
  switch (intent.refreshMode) {
    case 'fetch':
      return refreshAndPrepareDigest(options, intent);
    case 'rebuild':
      return prepareLatestDiscussionDigest(options.cwd);
    default:
      return loadOrPrepareDigest(options.cwd);
  }
}

async function loadOrPrepareDigest(cwd: string): Promise<PreparedDiscussionDigest> {
  const digest = await loadLatestPreparedDiscussionDigest(cwd);
  if (digest) {
    return digest;
  }

  return prepareLatestDiscussionDigest(cwd);
}

function renderAnswer(digest: PreparedDiscussionDigest, intent: DiscussionAnalyzerIntent): string {
  const selectedRecords = selectRelevantRecords(digest, intent);
  const records = intent.answerShape.wantsCategoryHealth ? selectedRecords : selectedRecords.slice(0, 12);
  const countSummary = deriveCountSummary(records, intent);
  const categoryGroups = groupRecordsByCategory(countSummary?.records ?? records);

  if (intent.answerShape.wantsCategoryHealth && intent.parsedFilters.category) {
    return renderCategoryHealthAnswer(digest, intent, records);
  }

  const lines: string[] = [
    `# GitHub Discussions Digest: ${digest.repository.owner}/${digest.repository.name}`,
    '',
    `**Question:** ${intent.question}  `,
    `**Source Run:** \`${digest.sourceRunId}\`  `,
    `**Data Prepared:** ${digest.timestamp}  `,
    `**Total Discussions:** ${digest.totals.discussions}  `,
    `**Answer Source:** ${describeAnswerSource(intent)}  `,
    '',
  ];

  if (countSummary) {
    lines.push('## Count Summary');
    lines.push(`**Counted Discussions:** ${countSummary.count}  `);
    lines.push(`**Basis:** ${countSummary.basis}  `);
    lines.push('');
  }

  lines.push('## Category Summary');
  lines.push('| Category | Discussions | Status Breakdown |');
  lines.push('| :--- | ---: | :--- |');

  for (const [category, groupedRecords] of categoryGroups) {
    lines.push(
      `| ${category} | ${groupedRecords.length} | ${formatCountMap(countBy(groupedRecords.map((record) => record.status)))} |`,
    );
  }
  lines.push('');

  if (categoryGroups.size === 0) {
    lines.push('## Matching Discussions');
    lines.push('No discussions matched the requested scope in the prepared digest.');
    lines.push('');
  }

  for (const [category, groupedRecords] of categoryGroups) {
    lines.push(`## ${category}`);
    lines.push(`**Discussions:** ${groupedRecords.length}  `);
    lines.push(`**Statuses:** ${formatCountMap(countBy(groupedRecords.map((record) => record.status)))}  `);
    lines.push('');

    for (const record of groupedRecords) {
      lines.push(`### ${record.title} (#${record.number})`);
      lines.push(`- **Status:** ${record.status}`);
      lines.push(`- **Issue:** ${record.issue}`);
      lines.push(`- **Key Context:** ${record.keyContext.join(' | ') || 'No additional context extracted.'}`);
      lines.push(`- **Resolution:** ${record.resolution}`);
      lines.push(`- **Action Items:** ${record.actionItems.join('; ')}`);
      lines.push('');
    }
  }

  if (intent.answerShape.wantsPatterns) {
    lines.push('## Pattern Analysis', '');
    lines.push('**Derived Themes:**');
    renderThemeSummary(deriveThemeGroups(selectedRecords))
      .forEach((line) => lines.push(line));
    lines.push('');
  }

  if (intent.answerShape.wantsEffectiveness) {
    lines.push('## Support Effectiveness Analysis', '');
    lines.push('#### Strengths ✅');
    lines.push(`- ${digest.totals.statuses.resolved ?? 0} discussions show a resolved outcome.`);
    lines.push('');
    lines.push('#### Weaknesses ❌');
    lines.push(`- ${digest.totals.statuses.unresolved ?? 0} discussions still appear unresolved.`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function selectRelevantRecords(
  digest: PreparedDiscussionDigest,
  intent: DiscussionAnalyzerIntent,
): PreparedDiscussionDigest['records'] {
  const recordsInWindow = digest.records.filter((record) => matchesIntentWindow(record, intent));
  const recordsInCategory = intent.parsedFilters.category
    ? recordsInWindow.filter((record) => {
        const normalizedCategory = intent.parsedFilters.category?.toLowerCase();
        return (
          record.category.toLowerCase() === normalizedCategory ||
          record.categorySlug.toLowerCase() === normalizedCategory
        );
      })
    : recordsInWindow;

  if (!shouldUseKeywordFiltering(intent)) {
    return recordsInCategory;
  }

  return filterRelevantRecords(recordsInCategory, intent.normalizedQuestion);
}

function shouldUseKeywordFiltering(intent: DiscussionAnalyzerIntent): boolean {
  if (intent.answerShape.wantsCategoryHealth || intent.answerShape.wantsCounts) {
    return false;
  }

  if (intent.parsedFilters.category || intent.parsedFilters.when || intent.parsedFilters.after || intent.parsedFilters.before) {
    return false;
  }

  return true;
}

function filterRelevantRecords(records: PreparedDiscussionDigest['records'], question: string) {
  const keywords = question
    .split(/\W+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 4);

  if (keywords.length === 0) {
    return records;
  }

  const scored = records.map((record) => {
    const haystack = `${record.title} ${record.issue} ${record.resolution} ${record.category} ${record.kind}`.toLowerCase();
    const score = keywords.reduce((acc, keyword) => acc + (haystack.includes(keyword) ? 1 : 0), 0);
    return { record, score };
  });

  const matching = scored.filter((entry) => entry.score > 0).sort((left, right) => right.score - left.score);
  return matching.length > 0 ? matching.map((entry) => entry.record) : records;
}

function matchesIntentWindow(record: PreparedDiscussionDigest['records'][number], intent: DiscussionAnalyzerIntent): boolean {
  if (!intent.parsedFilters.after && !intent.parsedFilters.before) {
    return true;
  }

  const timestamp = new Date(intent.temporalField === 'createdAt' ? record.createdAt : record.updatedAt);
  if (Number.isNaN(timestamp.getTime())) {
    return false;
  }

  if (intent.parsedFilters.after && timestamp < new Date(intent.parsedFilters.after)) {
    return false;
  }
  if (intent.parsedFilters.before && timestamp > new Date(intent.parsedFilters.before)) {
    return false;
  }

  return true;
}

function assertDiscussionScopedQuestion(intent: DiscussionAnalyzerIntent): void {
  if (intent.scope !== 'issues') {
    return;
  }

  throw new DiscussionsOnlyAnalyzerError(
    ['Forge analyzes GitHub Discussions only.', `Want "${intent.redirectQuestion ?? intent.question}" instead?`].join(
      '\n',
    ),
  );
}

async function refreshAndPrepareDigest(
  options: RunDiscussionAnalyzerOptions,
  intent: DiscussionAnalyzerIntent,
): Promise<PreparedDiscussionDigest> {
  const fetched = await runDiscussionFetch({
    cwd: options.cwd,
    token: options.token,
    when: intent.parsedFilters.when,
    after: intent.parsedFilters.after,
    before: intent.parsedFilters.before,
    category: intent.parsedFilters.category,
    dateField: intent.temporalField,
    limit: options.limit ?? DEFAULT_ANALYZER_REFRESH_LIMIT,
  });

  if (fetched.filters.resolvedCategory) {
    await savePreferredDiscussionCategory(options.cwd, fetched.filters.resolvedCategory);
  }

  return prepareLatestDiscussionDigest(options.cwd);
}

function deriveCountSummary(
  records: PreparedDiscussionDigest['records'],
  intent: DiscussionAnalyzerIntent,
): { count: number; basis: string; records: PreparedDiscussionDigest['records'] } | null {
  if (!intent.answerShape.wantsCounts) {
    return null;
  }

  return {
    count: records.length,
    basis: describeCountBasis(intent),
    records,
  };
}

async function persistAnalysisTrace(
  cwd: string,
  digest: PreparedDiscussionDigest,
  intent: DiscussionAnalyzerIntent,
  answer: string,
): Promise<void> {
  const context = deriveSidecarContext(cwd);
  const timestamp = new Date().toISOString();
  const traceId = `${digest.id}-${timestamp.replace(/[:.]/g, '-')}`;
  const runsPath = path.join(context.sidecarPath, 'discussions', 'analysis', 'runs');
  const runDir = path.join(runsPath, traceId);
  await mkdir(runDir, { recursive: true });

  const trace: DiscussionAnalysisTrace = {
    version: '1.0',
    id: traceId,
    timestamp,
    question: intent.question,
    repository: digest.repository,
    digestId: digest.id,
    sourceRunId: digest.sourceRunId,
    decision: {
      refreshUsed: intent.refreshMode !== 'cached',
      refreshReason: intent.refreshReason,
      source: describeTraceSource(intent),
      parsedFilters: {
        when: intent.parsedFilters.when,
        after: intent.parsedFilters.after,
        before: intent.parsedFilters.before,
        category: intent.parsedFilters.category,
        dateField: intent.parsedFilters.dateField,
      },
    },
    answer,
    digest,
  };

  await writeFile(path.join(runDir, 'trace.json'), JSON.stringify(trace, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'question.txt'), `${intent.question.trim()}\n`, 'utf8');
  await writeFile(path.join(runDir, 'answer.md'), answer, 'utf8');
  await writeFile(path.join(runDir, 'digest.json'), JSON.stringify(digest, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'digest.md'), renderDigestSnapshot(digest), 'utf8');

  await writeFile(
    path.join(context.sidecarPath, 'discussions', 'analysis', 'latest-answer.json'),
    JSON.stringify(trace, null, 2),
    'utf8',
  );
  await writeFile(path.join(context.sidecarPath, 'discussions', 'analysis', 'latest-answer.md'), answer, 'utf8');
}

function renderDigestSnapshot(digest: PreparedDiscussionDigest): string {
  const lines = [
    `# Analysis Input Digest: ${digest.repository.owner}/${digest.repository.name}`,
    '',
    `**Digest ID:** \`${digest.id}\`  `,
    `**Source Run:** \`${digest.sourceRunId}\`  `,
    `**Timestamp:** ${digest.timestamp}  `,
    `**Discussion Count:** ${digest.totals.discussions}  `,
    '',
    '## Records',
    '',
  ];

  for (const record of digest.records) {
    lines.push(`### #${record.number}: ${record.title}`);
    lines.push(`- Status: ${record.status}`);
    lines.push(`- Kind: ${record.kind}`);
    lines.push(`- Category: ${record.category}`);
    lines.push(`- Issue: ${record.issue}`);
    lines.push(`- Resolution: ${record.resolution}`);
    lines.push('');
  }

  return lines.join('\n').trim();
}

function describeAnswerSource(intent: DiscussionAnalyzerIntent): string {
  switch (intent.refreshMode) {
    case 'fetch':
      return `fresh fetch (${intent.refreshReason})`;
    case 'rebuild':
      return 'rebuilt from latest raw discussion run';
    default:
      return 'cached prepared digest';
  }
}

function describeTraceSource(intent: DiscussionAnalyzerIntent): DiscussionAnalysisTrace['decision']['source'] {
  switch (intent.refreshReason) {
    case 'explicit-force-refresh':
      return 'explicit-refresh';
    case 'explicit-refresh-analysis':
      return 'rebuild-latest-run';
    case 'current-status-question':
    case 'time-scoped-question':
      return 'implicit-refresh';
    default:
      return 'cached-digest';
  }
}

function describeCountBasis(intent: DiscussionAnalyzerIntent): string {
  const segments: string[] = [];
  if (intent.parsedFilters.when) {
    segments.push(intent.parsedFilters.when);
  }
  if (intent.parsedFilters.after) {
    segments.push(`after ${intent.parsedFilters.after}`);
  }
  if (intent.parsedFilters.before) {
    segments.push(`before ${intent.parsedFilters.before}`);
  }

  return segments.length > 0
    ? `${intent.temporalField} filtered by ${segments.join(' and ')}`
    : `${intent.temporalField} across the prepared digest`;
}

function renderCategoryHealthAnswer(
  digest: PreparedDiscussionDigest,
  intent: DiscussionAnalyzerIntent,
  records: PreparedDiscussionDigest['records'],
): string {
  const categoryLabel = records[0]?.category ?? intent.parsedFilters.category ?? 'Selected Category';
  const unresolvedOrBlocked = records.filter((record) => record.status === 'unresolved' || record.status === 'blocked');
  const statusCounts = countBy(records.map((record) => record.status));
  const themeGroups = deriveThemeGroups(records);

  const lines: string[] = [
    `# GitHub Discussions Category Health: ${categoryLabel}`,
    '',
    `**Question:** ${intent.question}  `,
    `**Source Run:** \`${digest.sourceRunId}\`  `,
    `**Answer Source:** ${describeAnswerSource(intent)}  `,
    `**Total Discussions:** ${records.length}  `,
    '',
    '## Status Breakdown',
    `- answered: ${(statusCounts.answered ?? 0) + (statusCounts.resolved ?? 0)}`,
    `- unresolved: ${statusCounts.unresolved ?? 0}`,
    `- blocked: ${statusCounts.blocked ?? 0}`,
    '',
    '## Major Themes',
    ...renderThemeSummary(themeGroups),
    '',
  ];

  if (unresolvedOrBlocked.length === 0) {
    lines.push('## Unresolved And Blocked Discussions');
    lines.push('No unresolved or blocked discussions in this category.');
    lines.push('');
  } else {
    lines.push('## Unresolved And Blocked Discussions', '');
    for (const record of unresolvedOrBlocked) {
      lines.push(`### ${record.title} (#${record.number})`);
      lines.push(`- **Status:** ${record.status}`);
      lines.push(`- **Issue:** ${record.issue}`);
      lines.push(`- **Resolution:** ${record.resolution}`);
      lines.push(`- **Action Items:** ${record.actionItems.join('; ')}`);
      lines.push('');
    }
  }

  if (records.length > 8) {
    lines.push('## Discussions By Theme', '');
    for (const [theme, themeRecords] of themeGroups) {
      lines.push(`### ${theme} (${themeRecords.length})`);
      for (const record of themeRecords.slice(0, 5)) {
        lines.push(`- #${record.number} ${record.title} [${record.status}]`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

function deriveThemeGroups(
  records: PreparedDiscussionDigest['records'],
): Map<string, PreparedDiscussionDigest['records']> {
  const grouped = new Map<string, PreparedDiscussionDigest['records']>();
  const tokenFrequencies = countBy(records.flatMap((record) => extractThemeTokens(record)));

  for (const record of records) {
    const theme = inferThemeLabel(record, tokenFrequencies);
    const existing = grouped.get(theme) ?? [];
    existing.push(record);
    grouped.set(theme, existing);
  }
  return new Map([...grouped.entries()].sort((left, right) => right[1].length - left[1].length));
}

function renderThemeSummary(
  themeGroups: Map<string, PreparedDiscussionDigest['records']>,
): string[] {
  const lines: string[] = [];
  for (const [kind, kindRecords] of themeGroups) {
    const sampleTitles = kindRecords.slice(0, 3).map((record) => `#${record.number} ${record.title}`).join('; ');
    lines.push(`- ${kind}: ${kindRecords.length} discussion(s)${sampleTitles ? ` — ${sampleTitles}` : ''}`);
  }
  return lines;
}

function inferThemeLabel(
  record: PreparedDiscussionDigest['records'][number],
  tokenFrequencies: Record<string, number>,
): string {
  const tokens = extractThemeTokens(record);
  const rankedToken = [...new Set(tokens)]
    .sort((left, right) => {
      return (tokenFrequencies[right] ?? 0) - (tokenFrequencies[left] ?? 0) || left.localeCompare(right);
    })[0];

  if (rankedToken) {
    return toTitleCase(rankedToken);
  }

  const fallback = record.title.trim();
  return fallback.length > 0 ? fallback : 'General';
}

function extractThemeTokens(record: PreparedDiscussionDigest['records'][number]): string[] {
  const rawTokens = `${record.title} ${record.issue}`
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);

  return rawTokens.filter((token) => !THEME_STOP_WORDS.has(token));
}

const THEME_STOP_WORDS = new Set([
  'about',
  'after',
  'because',
  'been',
  'between',
  'customer',
  'customers',
  'discussion',
  'discussions',
  'doing',
  'from',
  'have',
  'into',
  'issue',
  'last',
  'looking',
  'question',
  'questions',
  'reported',
  'support',
  'their',
  'there',
  'these',
  'this',
  'those',
  'week',
  'with',
]);

function toTitleCase(value: string): string {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function groupRecordsByCategory(
  records: PreparedDiscussionDigest['records'],
): Map<string, PreparedDiscussionDigest['records']> {
  const grouped = new Map<string, PreparedDiscussionDigest['records']>();
  const sorted = [...records].sort((left, right) => {
    if (left.category === right.category) {
      return right.updatedAt.localeCompare(left.updatedAt);
    }
    return left.category.localeCompare(right.category);
  });

  for (const record of sorted) {
    const existing = grouped.get(record.category) ?? [];
    existing.push(record);
    grouped.set(record.category, existing);
  }

  return grouped;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function formatCountMap(values: Record<string, number>): string {
  return Object.entries(values)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label}: ${count}`)
    .join(', ');
}
