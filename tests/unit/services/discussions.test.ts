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
import { analyzeDiscussionRequestIntent } from '../../../src/services/discussions/request-intent.js';
import * as discussionRunService from '../../../src/services/discussions/run.js';
import { loadPreferredDiscussionCategory, savePreferredDiscussionCategory } from '../../../src/services/discussions/preferences.js';
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
          comments: [
            {
              bodyText: 'cc @retina for repo automation details',
              author: 'maintainer',
              createdAt: '2026-03-03T08:30:00.000Z',
            },
          ],
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
                    comments: {
                      totalCount: 3,
                      nodes: [
                        {
                          body: 'Loop in @omnibase for fetch handling.',
                          bodyText: 'Loop in @omnibase for fetch handling.',
                          createdAt: '2026-03-03T09:05:00.000Z',
                          author: { login: 'teammate' },
                        },
                      ],
                    },
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
    expect(result.discussions[0]?.comments[0]?.bodyText).toContain('@omnibase');
  });

  it('paginates across multiple GitHub discussion pages', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            repository: {
              discussionCategories: {
                nodes: [{ id: 'cat1', name: 'Ideas', slug: 'ideas' }],
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
                nodes: [{ id: 'cat1', name: 'Ideas', slug: 'ideas' }],
              },
              discussions: {
                pageInfo: {
                  hasNextPage: true,
                  endCursor: 'cursor-1',
                },
                nodes: Array.from({ length: 100 }, (_, index) => ({
                  id: `D_${index + 1}`,
                  number: index + 1,
                  title: `Discussion ${index + 1}`,
                  url: `https://github.com/ajitgunturi/forge/discussions/${index + 1}`,
                  createdAt: '2026-03-03T08:00:00.000Z',
                  updatedAt: '2026-03-03T09:00:00.000Z',
                  answerChosenAt: null,
                  bodyText: 'Paged fetch test.',
                  upvoteCount: 0,
                  author: { login: 'ajitg' },
                  category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
                  comments: { totalCount: 2, nodes: [] },
                })),
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
                nodes: [{ id: 'cat1', name: 'Ideas', slug: 'ideas' }],
              },
              discussions: {
                pageInfo: {
                  hasNextPage: false,
                  endCursor: null,
                },
                nodes: Array.from({ length: 20 }, (_, index) => ({
                  id: `D_${index + 101}`,
                  number: index + 101,
                  title: `Discussion ${index + 101}`,
                  url: `https://github.com/ajitgunturi/forge/discussions/${index + 101}`,
                  createdAt: '2026-03-03T08:00:00.000Z',
                  updatedAt: '2026-03-03T09:00:00.000Z',
                  answerChosenAt: null,
                  bodyText: 'Paged fetch test.',
                  upvoteCount: 0,
                  author: { login: 'ajitg' },
                  category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
                  comments: { totalCount: 2, nodes: [] },
                })),
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
        limit: 120,
      }),
    });

    expect(result.discussions).toHaveLength(120);
    expect(result.pageInfo.fetchedPages).toBe(2);
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
          comments: [
            {
              bodyText: '@mss confirmed the token workaround resolves the install path.',
              author: 'support',
              createdAt: '2026-03-03T09:10:00.000Z',
            },
          ],
          upvoteCount: 2,
        },
      ],
    });

    expect(digest.records[0]?.status).toBe('resolved');
    expect(digest.records[0]?.issue).toContain('Install fails');
    expect(digest.records[0]?.createdAt).toBe('2026-03-03T08:00:00.000Z');
    expect(digest.records[0]?.categorySlug).toBe('q-a');
    expect(digest.records[0]?.teamMentions).toContain('@mss');
    expect(digest.records[0]?.searchableText).toContain('token workaround');
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
          comments: [
            {
              bodyText: '@retina says the auth setup docs are still missing a step.',
              author: 'ops',
              createdAt: '2026-03-03T09:05:00.000Z',
            },
          ],
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
    expect(answer).toContain('## Ideas');
    expect(answer).toContain('**Kinds:** feature-request: 1');

    const latestAnswerRaw = await readFile(
      join(tempDir, '.forge/discussions/analysis/latest-answer.json'),
      'utf8',
    );
    const latestAnswer = JSON.parse(latestAnswerRaw) as {
      question: string;
      answer: string;
      digestId: string;
      decision: {
        refreshUsed: boolean;
        refreshReason: string;
        source: string;
      };
    };

    expect(latestAnswer.question).toBe('What recurring patterns are visible in support discussions?');
    expect(latestAnswer.answer).toContain('Pattern Analysis');
    expect(latestAnswer.digestId).toBe('2026-03-03T10-00-00-000Z-analysis');
    expect(latestAnswer.decision.refreshUsed).toBe(false);
    expect(latestAnswer.decision.source).toBe('cached-digest');

    const latestAnswerMarkdown = await readFile(
      join(tempDir, '.forge/discussions/analysis/latest-answer.md'),
      'utf8',
    );
    expect(latestAnswerMarkdown).toContain('GitHub Discussions Digest');
  });

  it('reports count-style questions against implicitly refreshed discussion data', async () => {
    const context = deriveSidecarContext(tempDir);
    const staleRun = {
      version: '1.0' as const,
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ limit: 500 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 2,
      discussions: [
        {
          id: 'D_4',
          number: 201,
          title: 'Created in 2026',
          url: 'https://github.com/ajitgunturi/forge/discussions/201',
          createdAt: '2026-01-02T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
          bodyText: 'Count me.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
        {
          id: 'D_5',
          number: 202,
          title: 'Created in 2025',
          url: 'https://github.com/ajitgunturi/forge/discussions/202',
          createdAt: '2025-12-31T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
          bodyText: 'Do not count me.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
      ],
    };
    const freshRun = {
      ...staleRun,
      id: '2026-03-03T11-00-00-000Z',
      timestamp: '2026-03-03T11:00:00.000Z',
    };

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, staleRun);
    await persistPreparedDiscussionDigest(tempDir, staleRun);

    const fetchSpy = vi.spyOn(discussionRunService, 'runDiscussionFetch').mockImplementation(async () => {
      await persistDiscussionRun(context, freshRun);
      return freshRun;
    });

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'count discussions created since 2026-01-01',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(answer).toContain('## Count Summary');
      expect(answer).toContain('**Counted Discussions:** 1');
      expect(answer).toContain('createdAt filtered by after 2026-01-01T00:00:00.000Z');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('fails fast when the question asks for issues instead of discussions', async () => {
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
      filters: normalizeDiscussionFilters({ limit: 50 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 1,
      discussions: [
        {
          id: 'D_6',
          number: 301,
          title: 'Discussion scope test',
          url: 'https://github.com/ajitgunturi/forge/discussions/301',
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Ideas', slug: 'ideas' },
          bodyText: 'Discussion for scope guard test.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
      ],
    };

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, run);
    await persistPreparedDiscussionDigest(tempDir, run);

    await expect(
      runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'show me issues created in the last week',
      }),
    ).rejects.toThrow(/Forge analyzes GitHub Discussions only/);

    await expect(
      runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'show me issues created in the last week',
      }),
    ).rejects.toThrow(/Want "show me discussions created in the last week" instead/);
  });

  it('parses current-status and summary intents differently', () => {
    const currentIntent = analyzeDiscussionRequestIntent({
      question: 'what is the current status of customer support discussions?',
    });
    const summaryIntent = analyzeDiscussionRequestIntent({
      question: 'give me a summary of customer support discussions',
    });

    expect(currentIntent.refreshMode).toBe('fetch');
    expect(currentIntent.refreshReason).toBe('current-status-question');
    expect(summaryIntent.refreshMode).toBe('cached');
    expect(summaryIntent.refreshReason).toBe('cached-local-question');
  });

  it('parses explicit question windows into normalized filters', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'count discussions created between 2026-01-01 and 2026-01-31 in the customer support category',
      limit: 25,
    });

    expect(intent.refreshMode).toBe('fetch');
    expect(intent.parsedFilters.after).toBe('2026-01-01T00:00:00.000Z');
    expect(intent.parsedFilters.before).toBe('2026-01-31T23:59:59.999Z');
    expect(intent.parsedFilters.category).toBe('customer support');
    expect(intent.temporalField).toBe('createdAt');
  });

  it('uses a saved preferred category for current-status prompts', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'how is it looking?',
      preferredCategory: {
        name: 'Customer Support',
        slug: 'customer-support',
      },
    });

    expect(intent.parsedFilters.category).toBe('customer-support');
    expect(intent.categorySource).toBe('preferred');
    expect(intent.answerShape.wantsCategoryHealth).toBe(true);
  });

  it('treats "how is customer support looking" as category health analysis', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'how is customer support looking?',
    });

    expect(intent.parsedFilters.category).toBe('customer support');
    expect(intent.refreshMode).toBe('fetch');
    expect(intent.answerShape.wantsCategoryHealth).toBe(true);
  });

  it('persists the preferred discussion category', async () => {
    const context = deriveSidecarContext(tempDir);
    await writeMetadata(context.metadataPath, createNewMetadata());

    await savePreferredDiscussionCategory(tempDir, {
      id: 'cat1',
      name: 'Customer Support',
      slug: 'customer-support',
    });

    const preferred = await loadPreferredDiscussionCategory(tempDir);
    expect(preferred?.slug).toBe('customer-support');
    expect(preferred?.name).toBe('Customer Support');
  });

  it('refreshes automatically for current-status questions and records trace metadata', async () => {
    const context = deriveSidecarContext(tempDir);
    const staleRun = {
      version: '1.0' as const,
      id: '2026-03-02T10-00-00-000Z',
      timestamp: '2026-03-02T10:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ limit: 50 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 1,
      discussions: [
        {
          id: 'D_stale',
          number: 401,
          title: 'Old support thread',
          url: 'https://github.com/ajitgunturi/forge/discussions/401',
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-02T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Stale snapshot.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
      ],
    };
    const freshRun = {
      ...staleRun,
      id: '2026-03-03T10-00-00-000Z',
      timestamp: '2026-03-03T10:00:00.000Z',
      discussions: [
        {
          id: 'D_fresh',
          number: 402,
          title: 'Current support thread',
          url: 'https://github.com/ajitgunturi/forge/discussions/402',
          createdAt: '2026-03-03T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Fresh snapshot.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
      ],
    };

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, staleRun);
    await persistPreparedDiscussionDigest(tempDir, staleRun);

    const fetchSpy = vi.spyOn(discussionRunService, 'runDiscussionFetch').mockImplementation(async () => {
      await persistDiscussionRun(context, freshRun);
      return freshRun;
    });

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'what is the current status of customer support discussions?',
      });

      expect(answer).toContain('Current support thread');
      expect(answer).toContain('GitHub Discussions Category Health: Customer Support');

      const latestAnswerRaw = await readFile(
        join(tempDir, '.forge/discussions/analysis/latest-answer.json'),
        'utf8',
      );
      const latestAnswer = JSON.parse(latestAnswerRaw) as {
        decision: {
          refreshUsed: boolean;
          refreshReason: string;
          source: string;
        };
      };

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(latestAnswer.decision.refreshUsed).toBe(true);
      expect(latestAnswer.decision.refreshReason).toBe('current-status-question');
      expect(latestAnswer.decision.source).toBe('implicit-refresh');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('renders category health answers with totals, status breakdown, unresolved items, and themes', async () => {
    const context = deriveSidecarContext(tempDir);
    const run = {
      version: '1.0' as const,
      id: '2026-03-03T12-00-00-000Z',
      timestamp: '2026-03-03T12:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ category: 'customer-support', limit: 100 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 3,
      discussions: [
        {
          id: 'D_501',
          number: 501,
          title: 'Login outage',
          url: 'https://github.com/ajitgunturi/forge/discussions/501',
          createdAt: '2026-03-03T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Customers report login failures. blocked on upstream identity service.',
          commentsCount: 2,
          comments: [
            {
              bodyText: '@omnibase is investigating the upstream identity service dependency.',
              author: 'support',
              createdAt: '2026-03-03T09:15:00.000Z',
            },
          ],
          upvoteCount: 1,
        },
        {
          id: 'D_502',
          number: 502,
          title: 'Billing question',
          url: 'https://github.com/ajitgunturi/forge/discussions/502',
          createdAt: '2026-03-03T08:30:00.000Z',
          updatedAt: '2026-03-03T09:30:00.000Z',
          answerChosenAt: '2026-03-03T10:00:00.000Z',
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Customer asked about billing settings.',
          commentsCount: 3,
          comments: [],
          upvoteCount: 1,
        },
        {
          id: 'D_503',
          number: 503,
          title: 'Provisioning stuck',
          url: 'https://github.com/ajitgunturi/forge/discussions/503',
          createdAt: '2026-03-03T08:45:00.000Z',
          updatedAt: '2026-03-03T09:45:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Provisioning remains unresolved after retries.',
          commentsCount: 1,
          comments: [
            {
              bodyText: '@mss still needs environment logs from the customer.',
              author: 'triage',
              createdAt: '2026-03-03T10:10:00.000Z',
            },
          ],
          upvoteCount: 1,
        },
      ],
    };

    await writeMetadata(context.metadataPath, createNewMetadata());
    await persistDiscussionRun(context, run);
    await persistPreparedDiscussionDigest(tempDir, run);

    const answer = await runDiscussionAnalyzer({
      cwd: tempDir,
      question: 'how is customer support looking?',
      refreshAnalysis: true,
    });

    expect(answer).toContain('GitHub Discussions Category Health: Customer Support');
    expect(answer).toContain('**Total Discussions:** 3');
    expect(answer).toContain('## Status Breakdown');
    expect(answer).toContain('- unresolved: 1');
    expect(answer).toContain('- blocked: 1');
    expect(answer).toContain('## Unresolved And Blocked Discussions');
    expect(answer).toContain('Login outage');
    expect(answer).toContain('Provisioning stuck');
    expect(answer).toContain('## Major Themes');
  });
});
