import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PRReviewSummaryArtifact, PreparedPRReviewDigest } from '../../contracts/pr-reviews.js';
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
    throw new UserFacingError('A question is required when running forge-pr-review-analyzer.');
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

  return lines.join('\n').trim();
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
