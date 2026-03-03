import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { PreparedDiscussionDigest, DiscussionAnalysisTrace } from '../../contracts/discussions.js';
import { DiscussionArtifactsRequiredError } from '../../lib/errors.js';
import { loadLatestPreparedDiscussionDigest, prepareLatestDiscussionDigest } from './prepare.js';
import { deriveSidecarContext } from '../sidecar.js';

export interface RunDiscussionAnalyzerOptions {
  cwd: string;
  question: string;
  refresh?: boolean;
}

export async function runDiscussionAnalyzer(options: RunDiscussionAnalyzerOptions): Promise<string> {
  const digest = options.refresh
    ? await prepareLatestDiscussionDigest(options.cwd)
    : (await loadOrPrepareDigest(options.cwd));

  const answer = renderAnswer(digest, options.question);
  await persistAnalysisTrace(options.cwd, digest, options.question, answer);
  return answer;
}

async function loadOrPrepareDigest(cwd: string): Promise<PreparedDiscussionDigest> {
  const digest = await loadLatestPreparedDiscussionDigest(cwd);
  if (digest) {
    return digest;
  }

  return prepareLatestDiscussionDigest(cwd);
}

function renderAnswer(digest: PreparedDiscussionDigest, question: string): string {
  const normalizedQuestion = question.trim().toLowerCase();
  if (!normalizedQuestion) {
    throw new DiscussionArtifactsRequiredError('A question is required when running forge-discussion-analyzer.');
  }

  const includePatterns = shouldIncludePatternSection(normalizedQuestion);
  const includeEffectiveness = shouldIncludeEffectivenessSection(normalizedQuestion);
  const records = filterRelevantRecords(digest, normalizedQuestion).slice(0, 8);

  const lines: string[] = [
    `# GitHub Discussions Digest: ${digest.repository.owner}/${digest.repository.name}`,
    '',
    `**Question:** ${question}  `,
    `**Source Run:** \`${digest.sourceRunId}\`  `,
    `**Total Discussions:** ${digest.totals.discussions}  `,
    '',
    '## Summary Overview',
    '| Discussion | Category | Status | Key Takeaway |',
    '| :--- | :--- | :--- | :--- |',
  ];

  for (const record of records) {
    lines.push(
      `| [#${record.number} ${record.title}] | ${record.kind} | ${record.status} | ${record.resolution} |`
    );
  }

  lines.push('', '## Detailed Summaries', '');

  for (const record of records) {
    lines.push(`#### ${record.title} (#${record.number})`);
    lines.push(`* **Status:** ${record.status}`);
    lines.push(`* **Category:** ${record.kind}`);
    lines.push(`* **The Issue:** ${record.issue}`);
    lines.push(`* **Key Context:** ${record.keyContext.join(' | ') || 'No additional context extracted.'}`);
    lines.push(`* **The Resolution:** ${record.resolution}`);
    lines.push(`* **Action Items:** ${record.actionItems.join('; ')}`);
    lines.push('');
  }

  if (includePatterns) {
    lines.push('## Pattern Analysis', '');
    lines.push('**Issue Distribution:**');
    Object.entries(digest.totals.kinds)
      .sort((a, b) => b[1] - a[1])
      .forEach(([kind, count]) => {
        lines.push(`- ${kind}: ${count}`);
      });
    lines.push('');
  }

  if (includeEffectiveness) {
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

function filterRelevantRecords(digest: PreparedDiscussionDigest, question: string) {
  const keywords = question
    .split(/\W+/)
    .map((token) => token.toLowerCase())
    .filter((token) => token.length >= 4);

  if (keywords.length === 0) {
    return digest.records;
  }

  const scored = digest.records.map((record) => {
    const haystack = `${record.title} ${record.issue} ${record.resolution} ${record.category} ${record.kind}`.toLowerCase();
    const score = keywords.reduce((acc, keyword) => acc + (haystack.includes(keyword) ? 1 : 0), 0);
    return { record, score };
  });

  const matching = scored.filter((entry) => entry.score > 0).sort((a, b) => b.score - a.score);
  return matching.length > 0 ? matching.map((entry) => entry.record) : digest.records;
}

function shouldIncludePatternSection(question: string): boolean {
  return ['pattern', 'trend', 'common', 'theme', 'recurring'].some((keyword) => question.includes(keyword));
}

function shouldIncludeEffectivenessSection(question: string): boolean {
  return ['effectiveness', 'support quality', 'response time', 'sla', 'performance'].some((keyword) =>
    question.includes(keyword)
  );
}

async function persistAnalysisTrace(
  cwd: string,
  digest: PreparedDiscussionDigest,
  question: string,
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
    question,
    repository: digest.repository,
    digestId: digest.id,
    sourceRunId: digest.sourceRunId,
    answer,
    digest,
  };

  await writeFile(path.join(runDir, 'trace.json'), JSON.stringify(trace, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'question.txt'), `${question.trim()}\n`, 'utf8');
  await writeFile(path.join(runDir, 'answer.md'), answer, 'utf8');
  await writeFile(path.join(runDir, 'digest.json'), JSON.stringify(digest, null, 2), 'utf8');
  await writeFile(path.join(runDir, 'digest.md'), renderDigestSnapshot(digest), 'utf8');

  await writeFile(path.join(context.sidecarPath, 'discussions', 'analysis', 'latest-answer.json'), JSON.stringify(trace, null, 2), 'utf8');
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
