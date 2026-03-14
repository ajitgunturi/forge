import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PRReviewSummaryArtifact, PreparedPRReviewDigest, CommentCategory } from '../../contracts/pr-reviews.js';
import { UserFacingError } from '../../lib/errors.js';
import { deriveSidecarContext } from '../sidecar.js';
import { buildPreparedPRReviewDigest } from './prepare.js';
import { analyzePRReviewRequestIntent, PRReviewIntent } from './request-intent.js';
import { runPRReviewFetch } from './run.js';

export interface RunPRReviewAnalyzerOptions {
  cwd: string;
  question: string;
  forceRefresh?: boolean;
  refreshAnalysis?: boolean;
  token?: string;
  when?: string;
  after?: string;
  before?: string;
  pr?: number;
  reviewer?: string;
  limit?: number;
}

const DEFAULT_ANALYZER_REFRESH_LIMIT = 1000;

export async function runPRReviewAnalyzer(options: RunPRReviewAnalyzerOptions): Promise<string> {
  const intent = analyzePRReviewRequestIntent({
    question: options.question,
    forceRefresh: options.forceRefresh,
    refreshAnalysis: options.refreshAnalysis,
    when: options.when,
    after: options.after,
    before: options.before,
    pr: options.pr,
    reviewer: options.reviewer,
    limit: options.limit,
  });

  if (!intent.normalizedQuestion) {
    throw new UserFacingError('A question is required when running forge-pr-comments-analyzer.');
  }
  assertPRScopedQuestion(intent);

  const digest = await fetchDigestForIntent(options, intent);
  const answer = renderAnswer(digest, intent);
  await persistPRReviewSummary(options.cwd, digest, intent, answer);
  return answer;
}

async function fetchDigestForIntent(
  options: RunPRReviewAnalyzerOptions,
  intent: PRReviewIntent,
): Promise<PreparedPRReviewDigest> {
  const fetched = await runPRReviewFetch({
    cwd: options.cwd,
    token: options.token,
    when: intent.parsedFilters.when,
    after: intent.parsedFilters.after,
    before: intent.parsedFilters.before,
    pr: intent.parsedFilters.pr ?? options.pr,
    reviewer: intent.parsedFilters.reviewer ?? options.reviewer,
    dateField: intent.temporalField,
    limit: options.limit ?? DEFAULT_ANALYZER_REFRESH_LIMIT,
  });

  return buildPreparedPRReviewDigest(fetched);
}

function renderAnswer(digest: PreparedPRReviewDigest, intent: PRReviewIntent): string {
  const comments = digest.comments;
  const reviewerFilter = intent.parsedFilters.reviewer;

  const lines: string[] = [
    `# PR Review Analysis: ${digest.pr.title} (#${digest.pr.number})`,
    '',
    `**Question:** ${intent.question}  `,
    `**Source Run:** \`${digest.sourceRunId}\`  `,
    `**Data Prepared:** ${digest.timestamp}  `,
    `**PR State:** ${digest.pr.state}  `,
    `**Branch:** \`${digest.pr.branch}\` → \`${digest.pr.baseBranch}\`  `,
    `**Author:** @${digest.pr.author}  `,
    `**Changes:** +${digest.pr.additions} / -${digest.pr.deletions} across ${digest.pr.changedFiles} file(s)  `,
    `**Total Comments:** ${digest.totals.comments}${reviewerFilter ? ` (filtered to @${reviewerFilter})` : ''}  `,
    `**Answer Source:** live fetch  `,
    '',
  ];

  if (comments.length === 0) {
    lines.push('## No Comments Found');
    lines.push(reviewerFilter
      ? `No review comments found from @${reviewerFilter} on this PR.`
      : 'No review comments found on this PR.',
    );
    return lines.join('\n').trim();
  }

  // Severity summary
  lines.push('## Severity Breakdown');
  lines.push('| Severity | Count |');
  lines.push('| :--- | ---: |');
  for (const severity of ['critical', 'major', 'minor', 'informational'] as const) {
    const count = digest.totals.severities[severity] ?? 0;
    if (count > 0) {
      lines.push(`| ${severity} | ${count} |`);
    }
  }
  lines.push('');

  // Category summary
  lines.push('## Category Breakdown');
  lines.push('| Category | Count |');
  lines.push('| :--- | ---: |');
  for (const [category, count] of Object.entries(digest.totals.categories).sort((a, b) => b[1] - a[1])) {
    lines.push(`| ${category} | ${count} |`);
  }
  lines.push('');

  // File summary
  if (intent.answerShape.wantsFileSummary || Object.keys(digest.totals.filesCommented).length > 0) {
    const fileEntries = Object.entries(digest.totals.filesCommented).sort((a, b) => b[1] - a[1]);
    if (fileEntries.length > 0) {
      lines.push('## Files With Most Comments');
      lines.push('| File | Comments |');
      lines.push('| :--- | ---: |');
      for (const [filePath, count] of fileEntries.slice(0, 10)) {
        lines.push(`| \`${filePath}\` | ${count} |`);
      }
      lines.push('');
    }
  }

  // Reviewer summary
  if (Object.keys(digest.totals.reviewers).length > 1) {
    lines.push('## Reviewers');
    lines.push('| Reviewer | Comments |');
    lines.push('| :--- | ---: |');
    for (const [reviewer, count] of Object.entries(digest.totals.reviewers).sort((a, b) => b[1] - a[1])) {
      lines.push(`| @${reviewer} | ${count} |`);
    }
    lines.push('');
  }

  // Critical and major comments first
  const actionableComments = comments.filter((c) => c.severity === 'critical' || c.severity === 'major');
  if (actionableComments.length > 0) {
    lines.push('## Actionable Review Comments');
    lines.push('');
    for (const comment of actionableComments) {
      renderCommentBlock(lines, comment);
    }
  }

  // Surgical fixes section
  const fixableComments = comments.filter((c) => c.suggestedFix);
  if (fixableComments.length > 0) {
    lines.push('## Suggested Surgical Fixes');
    lines.push('');
    for (const comment of fixableComments) {
      const location = comment.path
        ? `\`${comment.path}${comment.line ? `:${comment.line}` : ''}\``
        : 'general';
      lines.push(`### ${comment.category} — ${location}`);
      lines.push(`**Reviewer:** @${comment.author}  `);
      lines.push(`**Severity:** ${comment.severity}  `);
      lines.push('');
      lines.push(`> ${truncateBody(comment.body, 200)}`);
      lines.push('');
      lines.push('**Fix:**');
      lines.push('```');
      lines.push(comment.suggestedFix!);
      lines.push('```');
      lines.push('');
    }
  }

  // Remaining minor/informational comments
  const minorComments = comments.filter(
    (c) => (c.severity === 'minor' || c.severity === 'informational') && !c.suggestedFix,
  );
  if (minorComments.length > 0) {
    lines.push('## Other Comments');
    lines.push('');
    for (const comment of minorComments.slice(0, 20)) {
      renderCommentBlock(lines, comment);
    }
    if (minorComments.length > 20) {
      lines.push(`*... and ${minorComments.length - 20} more minor/informational comments.*`);
      lines.push('');
    }
  }

  // Pattern analysis
  if (intent.answerShape.wantsPatterns) {
    lines.push('## Pattern Analysis', '');
    const categoryGroups = groupByCategory(comments);
    for (const [category, grouped] of categoryGroups) {
      const samples = grouped.slice(0, 3).map((c) => truncateBody(c.body, 60)).join('; ');
      lines.push(`- **${category}** (${grouped.length}): ${samples}`);
    }
    lines.push('');
  }

  // Developer growth digest
  const growthTopics = deriveGrowthTopics(digest);
  if (growthTopics.length > 0) {
    lines.push('## Developer Growth Digest');
    lines.push('');
    lines.push('Based on the review feedback patterns, here are topics to study for leveling up:');
    lines.push('');
    for (const topic of growthTopics) {
      lines.push(`### ${topic.priority === 'high' ? '!!' : topic.priority === 'medium' ? '!' : '-'} ${topic.area}`);
      lines.push(`**Why:** ${topic.reason}  `);
      lines.push(`**Topics to explore:**`);
      for (const item of topic.readingTopics) {
        lines.push(`- ${item}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n').trim();
}

interface GrowthTopic {
  area: string;
  priority: 'high' | 'medium' | 'low';
  reason: string;
  readingTopics: string[];
}

const CATEGORY_GROWTH_MAP: Record<CommentCategory, { area: string; readingTopics: string[] } | null> = {
  security: {
    area: 'Application Security',
    readingTopics: [
      'OWASP Top 10 — common web application vulnerabilities and mitigations',
      'Secure coding practices: input validation, output encoding, parameterized queries',
      'Authentication and authorization patterns (OAuth 2.0, JWT best practices)',
      'Secrets management and credential hygiene',
    ],
  },
  bug: {
    area: 'Defensive Programming & Correctness',
    readingTopics: [
      'Defensive programming: null safety, boundary checks, invariant assertions',
      'Error handling strategies: fail-fast vs. graceful degradation',
      'Debugging methodologies: bisection, minimal reproducers, root-cause analysis',
      'Type systems and static analysis tools for catching bugs at compile time',
    ],
  },
  performance: {
    area: 'Performance Engineering',
    readingTopics: [
      'Algorithmic complexity (Big-O) and data structure selection',
      'Database query optimization: indexing, N+1 detection, query plans',
      'Caching strategies: cache invalidation, layered caches, TTL design',
      'Profiling and benchmarking tools for your runtime (CPU, memory, I/O)',
    ],
  },
  logic: {
    area: 'Software Correctness & Edge Cases',
    readingTopics: [
      'Boundary value analysis and equivalence partitioning for edge cases',
      'Concurrency primitives: mutexes, semaphores, channels, lock-free patterns',
      'State machine design for modeling complex control flow',
      'Property-based testing and fuzzing to surface unexpected inputs',
    ],
  },
  testing: {
    area: 'Testing Strategy & Quality',
    readingTopics: [
      'Testing pyramid: unit, integration, and end-to-end test balance',
      'Test design: arrange-act-assert, fixtures, and deterministic tests',
      'Mocking vs. integration testing tradeoffs',
      'Code coverage metrics: what to measure and when coverage is misleading',
    ],
  },
  refactor: {
    area: 'Clean Code & Design Patterns',
    readingTopics: [
      'SOLID principles and when to apply (and when not to over-apply) them',
      'Refactoring patterns: extract method/class, replace conditional with polymorphism',
      'Code smells: long methods, feature envy, data clumps, shotgun surgery',
      'Martin Fowler\'s "Refactoring" — catalog of safe, incremental transforms',
    ],
  },
  naming: {
    area: 'Code Readability & Communication',
    readingTopics: [
      'Naming conventions: intention-revealing names, domain vocabulary consistency',
      'Self-documenting code: making code read like prose without excess comments',
      'Ubiquitous language (Domain-Driven Design) — aligning code names with business terms',
    ],
  },
  style: {
    area: 'Code Consistency & Tooling',
    readingTopics: [
      'Linters and formatters: configure once, enforce automatically (ESLint, Prettier, etc.)',
      'Team style guides: adopting and contributing to shared conventions',
      'EditorConfig and pre-commit hooks for automated consistency',
    ],
  },
  documentation: {
    area: 'Technical Documentation',
    readingTopics: [
      'Writing effective code comments: explain "why", not "what"',
      'API documentation: clear contracts, examples, and edge-case notes',
      'Architecture Decision Records (ADRs) for capturing design rationale',
    ],
  },
  general: null,
  approval: null,
  nitpick: null,
  question: null,
};

function deriveGrowthTopics(digest: PreparedPRReviewDigest): GrowthTopic[] {
  const topics: GrowthTopic[] = [];
  const comments = digest.comments;

  // Aggregate signal strength per category: critical=4, major=3, minor=1, informational=0
  const severityWeight: Record<string, number> = { critical: 4, major: 3, minor: 1, informational: 0 };
  const categorySignal = new Map<CommentCategory, number>();

  for (const comment of comments) {
    const weight = severityWeight[comment.severity] ?? 0;
    categorySignal.set(comment.category, (categorySignal.get(comment.category) ?? 0) + weight);
  }

  // Sort by signal strength descending, filter to categories with growth mappings
  const ranked = [...categorySignal.entries()]
    .filter(([cat]) => CATEGORY_GROWTH_MAP[cat] !== null)
    .sort((a, b) => b[1] - a[1]);

  for (const [category, signal] of ranked) {
    const mapping = CATEGORY_GROWTH_MAP[category];
    if (!mapping) continue;

    const count = digest.totals.categories[category] ?? 0;
    const priority: GrowthTopic['priority'] = signal >= 8 ? 'high' : signal >= 3 ? 'medium' : 'low';

    topics.push({
      area: mapping.area,
      priority,
      reason: `${count} review comment(s) in this category — focus area based on reviewer feedback`,
      readingTopics: mapping.readingTopics,
    });
  }

  return topics;
}

function renderCommentBlock(lines: string[], comment: PreparedPRReviewDigest['comments'][number]): void {
  const location = comment.path
    ? `\`${comment.path}${comment.line ? `:${comment.line}` : ''}\``
    : 'general';
  lines.push(`### [${comment.severity.toUpperCase()}] ${comment.category} — ${location}`);
  lines.push(`**Reviewer:** @${comment.author}  `);
  lines.push('');
  lines.push(`> ${truncateBody(comment.body, 300)}`);
  if (comment.suggestedFix) {
    lines.push('');
    lines.push('**Suggested Fix:**');
    lines.push('```');
    lines.push(comment.suggestedFix);
    lines.push('```');
  }
  lines.push('');
}

function groupByCategory(
  comments: PreparedPRReviewDigest['comments'],
): Map<string, PreparedPRReviewDigest['comments']> {
  const grouped = new Map<string, PreparedPRReviewDigest['comments']>();
  for (const comment of comments) {
    const existing = grouped.get(comment.category) ?? [];
    existing.push(comment);
    grouped.set(comment.category, existing);
  }
  return new Map([...grouped.entries()].sort((a, b) => b[1].length - a[1].length));
}

function truncateBody(body: string, maxLength: number): string {
  const oneLine = body.replace(/\n/g, ' ').trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, maxLength - 3).trimEnd()}...`;
}

function assertPRScopedQuestion(intent: PRReviewIntent): void {
  if (intent.scope === 'pr-reviews') {
    return;
  }

  const target = intent.scope === 'issues' ? 'GitHub Issues' : 'GitHub Discussions';
  throw new UserFacingError(
    `This analyzer covers PR reviews only, not ${target}. Use the appropriate Forge analyzer instead.`,
  );
}

async function persistPRReviewSummary(
  cwd: string,
  digest: PreparedPRReviewDigest,
  intent: PRReviewIntent,
  answer: string,
): Promise<void> {
  const context = deriveSidecarContext(cwd);
  const timestamp = new Date().toISOString();
  const summaryId = `${digest.sourceRunId}-summary-${timestamp.replace(/[:.]/g, '-')}`;
  const summaryBasePath = path.join(context.sidecarPath, 'pr-reviews', 'summary');
  const runsPath = path.join(summaryBasePath, 'runs');
  const runDir = path.join(runsPath, summaryId);
  await mkdir(runDir, { recursive: true });

  const summary: PRReviewSummaryArtifact = {
    version: '1.0',
    id: summaryId,
    timestamp,
    question: intent.question,
    repository: digest.repository,
    sourceRunId: digest.sourceRunId,
    source: 'live-fetch',
    filters: {
      pr: intent.parsedFilters.pr,
      reviewer: intent.parsedFilters.reviewer,
      after: intent.parsedFilters.after,
      before: intent.parsedFilters.before,
      dateField: intent.parsedFilters.dateField,
    },
    prNumber: digest.pr.number,
    commentCount: digest.totals.comments,
    categoryBreakdown: digest.totals.categories,
    severityBreakdown: digest.totals.severities,
    answer,
  };

  await writeFile(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'question.txt'), `${intent.question.trim()}\n`, 'utf8');
  await writeFile(path.join(runDir, 'answer.md'), answer, 'utf8');
  await writeFile(path.join(summaryBasePath, 'latest.json'), JSON.stringify(summary, null, 2), 'utf8');
  await writeFile(path.join(summaryBasePath, 'latest.md'), answer, 'utf8');
}
