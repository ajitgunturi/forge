import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubTokenRequiredError } from '../../../src/lib/errors.js';
import { createNewMetadata, writeMetadata } from '../../../src/services/metadata.js';
import { deriveSidecarContext } from '../../../src/services/sidecar.js';
import { loadLatestDiscussionRun, persistDiscussionRun } from '../../../src/services/discussions/artifacts.js';
import { runDiscussionAnalyzer } from '../../../src/services/discussions/analyze.js';
import { resolveGitHubToken } from '../../../src/services/discussions/auth.js';
import { fetchGitHubDiscussions } from '../../../src/services/discussions/fetch.js';
import {
  describeDiscussionFilters,
  normalizeDiscussionFilters,
} from '../../../src/services/discussions/filters.js';
import { buildPreparedDiscussionDigest, persistPreparedDiscussionDigest } from '../../../src/services/discussions/prepare.js';

describe('Discussions services', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'forge-discussions-'));
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('persists discussion runs and updates the latest pointer', async () => {
    const context = deriveSidecarContext(tempDir);
    const filters = normalizeDiscussionFilters({ when: 'today', limit: 10 });

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, {
      version: '1.0',
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters,
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 1,
      discussions: [
        {
          id: 'D_1',
          number: 12,
          title: 'Add repo sync',
          url: 'https://github.com/ajitgunturi/forge/discussions/12',
          createdAt: '2026-03-03T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: {
            id: 'cat1',
            name: 'Ideas',
            slug: 'ideas',
          },
          bodyText: 'Please add repository sync support.',
          commentsCount: 2,
          upvoteCount: 5,
        },
      ],
    });

    const latest = await loadLatestDiscussionRun(context);
    expect(latest?.discussionCount).toBe(1);

    const metadata = JSON.parse(await readFile(context.metadataPath, 'utf8')) as {
      discussions: {
        history: Array<Record<string, unknown>>;
      };
    };
    expect(metadata.discussions.history[0]).toEqual({
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      repository: 'ajitgunturi/forge',
      discussionCount: 1,
      artifactPath: 'discussions/runs/2026-03-03T10-00-00-000Z.json',
      filterDescription: describeDiscussionFilters(filters),
    });
  });

  it('resolves GitHub tokens from the environment', () => {
    vi.stubEnv('GH_TOKEN', 'gh-token');
    expect(resolveGitHubToken()).toBe('gh-token');

    vi.stubEnv('GH_TOKEN', '');
    vi.stubEnv('GITHUB_TOKEN', 'github-token');
    expect(resolveGitHubToken()).toBe('github-token');
  });

  it('throws when no GitHub token is available', () => {
    expect(() => resolveGitHubToken()).toThrow(GitHubTokenRequiredError);
  });

  it('normalizes relative discussion filters', () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    const filters = normalizeDiscussionFilters({ when: 'yesterday', limit: 5, now });

    expect(filters.when).toBe('yesterday');
    expect(filters.after).toBeDefined();
    expect(filters.before).toBeDefined();
    expect(filters.limit).toBe(5);
  });

  it('fetches discussions from GitHub and applies category/date filters', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              discussionCategories: {
                nodes: [
                  { id: 'cat1', name: 'Ideas', slug: 'ideas' },
                  { id: 'cat2', name: 'Q&A', slug: 'q-a' },
                ],
              },
              discussions: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [],
              },
            },
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              discussionCategories: {
                nodes: [
                  { id: 'cat1', name: 'Ideas', slug: 'ideas' },
                  { id: 'cat2', name: 'Q&A', slug: 'q-a' },
                ],
              },
              discussions: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: [
                  {
                    id: 'D_1',
                    number: 42,
                    title: 'Filterable fetch',
                    url: 'https://github.com/ajitgunturi/forge/discussions/42',
                    createdAt: '2026-03-02T08:00:00.000Z',
                    updatedAt: '2026-03-03T09:00:00.000Z',
                    answerChosenAt: null,
                    bodyText: 'Need filterable discussion fetches.',
                    upvoteCount: 4,
                    author: { login: 'ajitg' },
                    category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
                    comments: { totalCount: 3 },
                  },
                ],
              },
            },
          },
        }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchGitHubDiscussions({
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      token: 'token',
      filters: normalizeDiscussionFilters({
        when: 'today',
        category: 'ideas',
        limit: 10,
        now: new Date('2026-03-03T12:00:00.000Z'),
      }),
    });

    expect(result.resolvedCategory?.slug).toBe('ideas');
    expect(result.discussions).toHaveLength(1);
    expect(result.discussions[0]?.title).toBe('Filterable fetch');
  });

  it('prepares compact discussion digests from raw fetch artifacts', () => {
    const digest = buildPreparedDiscussionDigest({
      version: '1.0',
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ when: 'today', limit: 10 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 1,
      discussions: [
        {
          id: 'D_2',
          number: 99,
          title: 'Bug: install hangs',
          url: 'https://github.com/ajitgunturi/forge/discussions/99',
          createdAt: '2026-03-03T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: '2026-03-03T09:30:00.000Z',
          author: 'ajitg',
          category: { id: 'cat1', name: 'Q&A', slug: 'q-a' },
          bodyText: 'Install fails with a token error. Workaround is to export GH_TOKEN.',
          commentsCount: 4,
          upvoteCount: 2,
        },
      ],
    });

    expect(digest.records[0]?.status).toBe('resolved');
    expect(digest.records[0]?.issue).toContain('Install fails');
  });

  it('runs forge-discussion-analyzer from prepared sidecar artifacts', async () => {
    const context = deriveSidecarContext(tempDir);
    const run = {
      version: '1.0' as const,
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ when: 'today', limit: 10 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 1,
      discussions: [
        {
          id: 'D_3',
          number: 101,
          title: 'Patterns in support',
          url: 'https://github.com/ajitgunturi/forge/discussions/101',
          createdAt: '2026-03-03T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
          bodyText: 'Users repeatedly ask about authentication setup and filtering. This is unresolved.',
          commentsCount: 2,
          upvoteCount: 1,
        },
      ],
    };

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, run);
    await persistPreparedDiscussionDigest(tempDir, run);

    const answer = await runDiscussionAnalyzer({
      cwd: tempDir,
      question: 'What recurring patterns are visible in support discussions?',
    });

    expect(answer).toContain('Pattern Analysis');
    expect(answer).toContain('Patterns in support');

    const latestAnswerRaw = await readFile(
      join(tempDir, '.forge/discussions/analysis/latest-answer.json'),
      'utf8',
    );
    const latestAnswer = JSON.parse(latestAnswerRaw) as {
      question: string;
      answer: string;
      digestId: string;
    };

    expect(latestAnswer.question).toBe('What recurring patterns are visible in support discussions?');
    expect(latestAnswer.answer).toContain('Pattern Analysis');
    expect(latestAnswer.digestId).toBe('2026-03-03T10-00-00-000Z-analysis');

    const latestAnswerMarkdown = await readFile(
      join(tempDir, '.forge/discussions/analysis/latest-answer.md'),
      'utf8',
    );
    expect(latestAnswerMarkdown).toContain('GitHub Discussions Digest');
  });
});
