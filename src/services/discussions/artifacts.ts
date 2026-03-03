import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { SidecarContext } from '../sidecar.js';
import { readMetadata, writeMetadata } from '../metadata.js';
import { deriveSidecarRunPaths } from '../analysis/artifacts.js';
import {
  DISCUSSION_RUNS_SUBDIR,
  DISCUSSIONS_SUBDIR,
  LATEST_DISCUSSIONS_POINTER,
} from '../../config/analysis.js';
import { DiscussionRun, DiscussionRunSummary } from '../../contracts/discussions.js';
import { describeDiscussionFilters } from './filters.js';

export interface DiscussionPaths {
  base: string;
  runs: string;
  latest: string;
  latestMarkdown: string;
}

export function deriveDiscussionPaths(context: SidecarContext): DiscussionPaths {
  const paths = deriveSidecarRunPaths(
    context,
    DISCUSSIONS_SUBDIR,
    DISCUSSION_RUNS_SUBDIR,
    LATEST_DISCUSSIONS_POINTER
  );

  return {
    ...paths,
    latestMarkdown: path.join(paths.base, 'latest.md'),
  };
}

export async function registerDiscussionRun(
  context: SidecarContext,
  summary: DiscussionRunSummary
): Promise<void> {
  const metadata = await readMetadata(context.metadataPath);
  if (!metadata) {
    throw new Error(`Metadata file not found at ${context.metadataPath}`);
  }

  if (!metadata.discussions) {
    metadata.discussions = {
      history: [],
    };
  }

  metadata.discussions.lastRunId = summary.id;
  metadata.discussions.history.push(summary);
  metadata.updatedAt = new Date().toISOString();

  await writeMetadata(context.metadataPath, metadata);
}

export async function persistDiscussionRun(
  context: SidecarContext,
  run: DiscussionRun
): Promise<DiscussionRunSummary> {
  const paths = deriveDiscussionPaths(context);
  await mkdir(paths.runs, { recursive: true });

  const fileName = `${run.id}.json`;
  const markdownName = `${run.id}.md`;
  const artifactPath = path.join(paths.runs, fileName);
  const markdownPath = path.join(paths.runs, markdownName);

  const payload = JSON.stringify(run, null, 2);
  const markdown = discussionsToMarkdown(run);

  await writeFile(artifactPath, payload, 'utf8');
  await writeFile(markdownPath, markdown, 'utf8');
  await writeFile(paths.latest, payload, 'utf8');
  await writeFile(paths.latestMarkdown, markdown, 'utf8');

  const summary: DiscussionRunSummary = {
    id: run.id,
    timestamp: run.timestamp,
    repository: `${run.repository.owner}/${run.repository.name}`,
    discussionCount: run.discussionCount,
    artifactPath: path.relative(context.sidecarPath, artifactPath),
    filterDescription: describeDiscussionFilters(run.filters),
  };

  await registerDiscussionRun(context, summary);
  return summary;
}

export async function loadLatestDiscussionRun(context: SidecarContext): Promise<DiscussionRun | null> {
  const paths = deriveDiscussionPaths(context);
  try {
    const data = await readFile(paths.latest, 'utf8');
    return JSON.parse(data) as DiscussionRun;
  } catch {
    return null;
  }
}

export function discussionsToMarkdown(run: DiscussionRun): string {
  const lines: string[] = [
    `# GitHub Discussions Fetch: ${run.repository.owner}/${run.repository.name}`,
    '',
    `**Run ID:** \`${run.id}\`  `,
    `**Timestamp:** ${run.timestamp}  `,
    `**Filters:** ${describeDiscussionFilters(run.filters)}  `,
    `**Discussion Count:** ${run.discussionCount}  `,
    '',
    '## Discussions',
    '',
  ];

  if (run.discussions.length === 0) {
    lines.push('No discussions matched the requested filters.');
  } else {
    for (const discussion of run.discussions) {
      lines.push(`### #${discussion.number}: ${discussion.title}`);
      lines.push(`- URL: ${discussion.url}`);
      lines.push(`- Category: ${discussion.category.name} (${discussion.category.slug})`);
      lines.push(`- Updated: ${discussion.updatedAt}`);
      if (discussion.author) {
        lines.push(`- Author: ${discussion.author}`);
      }
      lines.push(`- Comments: ${discussion.commentsCount}`);
      lines.push(`- Upvotes: ${discussion.upvoteCount}`);
      lines.push('');
      lines.push(discussion.bodyText.slice(0, 280) || '(no body text)');
      lines.push('');
      if (discussion.comments.length > 0) {
        lines.push('#### Thread');
        lines.push('');
        for (const comment of discussion.comments) {
          const author = comment.author ?? 'unknown';
          lines.push(`- ${author} (${comment.createdAt}): ${comment.bodyText.slice(0, 280) || '(no body text)'}`);
        }
        lines.push('');
      }
    }
  }

  return lines.join('\n').trim();
}
