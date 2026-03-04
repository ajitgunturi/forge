import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubTokenRequiredError } from '../../../src/lib/errors.js';
import { runDiscussionAnalyzer } from '../../../src/services/discussions/analyze.js';
import { resolveGitHubToken } from '../../../src/services/discussions/auth.js';
import { fetchGitHubDiscussions } from '../../../src/services/discussions/fetch.js';
import { analyzeDiscussionRequestIntent } from '../../../src/services/discussions/request-intent.js';
import * as discussionRunService from '../../../src/services/discussions/run.js';
import {
  normalizeDiscussionFilters,
} from '../../../src/services/discussions/filters.js';
import { buildPreparedDiscussionDigest } from '../../../src/services/discussions/prepare.js';

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

  function mockAnalyzerFetch<T extends { id: string }>(run: T) {
    return vi.spyOn(discussionRunService, 'runDiscussionFetch').mockResolvedValue(run as never);
  }

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
    expect(filters.dateField).toBe('createdAt');
    expect(filters.limit).toBe(5);
  });

  it('normalizes last 1 week to the last-week discussion window', () => {
    const now = new Date('2026-03-03T12:00:00.000Z');
    const filters = normalizeDiscussionFilters({ when: 'last 1 week', limit: 5, now });

    expect(filters.when).toBe('last-week');
    expect(filters.dateField).toBe('createdAt');
  });

  it('defaults unbounded discussion fetches to updatedAt ordering', () => {
    const filters = normalizeDiscussionFilters({ limit: 5 });

    expect(filters.dateField).toBe('updatedAt');
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
                    createdAt: '2026-03-03T08:00:00.000Z',
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
    const secondRequestBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body)) as {
      variables: {
        orderField: string;
      };
    };
    expect(secondRequestBody.variables.orderField).toBe('CREATED_AT');
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

  it('runs forge-discussion-analyzer from live fetched discussions and saves a summary artifact', async () => {
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

    const fetchSpy = mockAnalyzerFetch(run);

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'What recurring patterns are visible in support discussions?',
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(answer).toContain('Pattern Analysis');
      expect(answer).toContain('Patterns in support');
      expect(answer).toContain('## Ideas');
      expect(answer).toContain('**Derived Themes:**');
      expect(answer).not.toContain('**Kinds:**');

      const latestSummaryRaw = await readFile(
        join(tempDir, '.forge/discussions/summary/latest.json'),
        'utf8',
      );
      const latestSummary = JSON.parse(latestSummaryRaw) as {
        question: string;
        answer: string;
        sourceRunId: string;
        source: string;
        discussionCount: number;
      };

      expect(latestSummary.question).toBe('What recurring patterns are visible in support discussions?');
      expect(latestSummary.answer).toContain('Pattern Analysis');
      expect(latestSummary.sourceRunId).toBe('2026-03-03T10-00-00-000Z');
      expect(latestSummary.source).toBe('live-fetch');
      expect(latestSummary.discussionCount).toBe(1);

      const latestSummaryMarkdown = await readFile(
        join(tempDir, '.forge/discussions/summary/latest.md'),
        'utf8',
      );
      expect(latestSummaryMarkdown).toContain('GitHub Discussions Digest');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('reports count-style questions against implicitly refreshed discussion data', async () => {
    const run = {
      version: '1.0' as const,
      id: '2026-03-03T11-00-00-000Z',
      timestamp: '2026-03-03T11:00:00.000Z',
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
    const fetchSpy = mockAnalyzerFetch(run);

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
    expect(summaryIntent.refreshMode).toBe('fetch');
    expect(summaryIntent.refreshReason).toBe('default-live-query');
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
    expect(intent.parsedFilters.dateField).toBe('createdAt');
    expect(intent.temporalField).toBe('createdAt');
  });

  it('parses update-oriented question windows against updatedAt', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'count discussions updated in the last week',
      limit: 25,
    });

    expect(intent.parsedFilters.when).toBe('last-week');
    expect(intent.parsedFilters.dateField).toBe('updatedAt');
    expect(intent.temporalField).toBe('updatedAt');
  });

  it('treats "how is customer support looking" as category health analysis', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'how is customer support looking?',
    });

    expect(intent.parsedFilters.category).toBe('customer support');
    expect(intent.refreshMode).toBe('fetch');
    expect(intent.answerShape.wantsCategoryHealth).toBe(true);
  });

  it('treats "how is customer support doing in the last 1 week" as category health analysis', () => {
    const intent = analyzeDiscussionRequestIntent({
      question: 'how is customer support doing in the last 1 week',
    });

    expect(intent.parsedFilters.category).toBe('customer support');
    expect(intent.parsedFilters.when).toBe('last-week');
    expect(intent.parsedFilters.dateField).toBe('createdAt');
    expect(intent.refreshMode).toBe('fetch');
    expect(intent.answerShape.wantsCategoryHealth).toBe(true);
  });

  it('runs current-status questions as live fetches and saves summary metadata', async () => {
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

    const fetchSpy = mockAnalyzerFetch(run);

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'what is the current status of customer support discussions?',
      });

      expect(answer).toContain('Current support thread');
      expect(answer).toContain('GitHub Discussions Category Health: Customer Support');

      const latestSummaryRaw = await readFile(
        join(tempDir, '.forge/discussions/summary/latest.json'),
        'utf8',
      );
      const latestSummary = JSON.parse(latestSummaryRaw) as {
        source: string;
        filters: {
          category?: string;
        };
        discussionCount: number;
      };

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(latestSummary.source).toBe('live-fetch');
      expect(latestSummary.filters.category).toBe('customer support');
      expect(latestSummary.discussionCount).toBe(1);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('renders category health answers with totals, status breakdown, unresolved items, and themes', async () => {
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

    const fetchSpy = mockAnalyzerFetch(run);

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'how is customer support looking?',
        refreshAnalysis: true,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(answer).toContain('GitHub Discussions Category Health: Customer Support');
      expect(answer).toContain('**Total Discussions:** 3');
      expect(answer).toContain('## Status Breakdown');
      expect(answer).toContain('- unresolved: 1');
      expect(answer).toContain('- blocked: 1');
      expect(answer).toContain('## Unresolved And Blocked Discussions');
      expect(answer).toContain('Login outage');
      expect(answer).toContain('Provisioning stuck');
      expect(answer).toContain('## Major Themes');
      expect(answer).not.toContain('**Kind:**');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not keyword-trim an explicitly scoped category health result set', async () => {
    const run = {
      version: '1.0' as const,
      id: '2026-03-03T13-00-00-000Z',
      timestamp: '2026-03-03T13:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ category: 'customer-support', when: 'last-week', limit: 100 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: 3,
      discussions: [
        {
          id: 'D_601',
          number: 601,
          title: 'Login outage',
          url: 'https://github.com/ajitgunturi/forge/discussions/601',
          createdAt: '2026-03-01T08:00:00.000Z',
          updatedAt: '2026-03-03T09:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Customers report login failures.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
        {
          id: 'D_602',
          number: 602,
          title: 'Billing question',
          url: 'https://github.com/ajitgunturi/forge/discussions/602',
          createdAt: '2026-03-01T10:00:00.000Z',
          updatedAt: '2026-03-03T10:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Customer asked about billing settings.',
          commentsCount: 2,
          comments: [],
          upvoteCount: 1,
        },
        {
          id: 'D_603',
          number: 603,
          title: 'Provisioning stuck',
          url: 'https://github.com/ajitgunturi/forge/discussions/603',
          createdAt: '2026-03-02T10:00:00.000Z',
          updatedAt: '2026-03-03T11:00:00.000Z',
          answerChosenAt: null,
          author: 'ajitg',
          category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
          bodyText: 'Provisioning remains unresolved after retries.',
          commentsCount: 1,
          comments: [],
          upvoteCount: 1,
        },
      ],
    };

    const fetchSpy = mockAnalyzerFetch(run);

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'how is customer support doing in the last 1 week',
        refreshAnalysis: true,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(answer).toContain('**Total Discussions:** 3');
      expect(answer).toContain('Login outage');
      expect(answer).toContain('Billing question');
      expect(answer).toContain('Provisioning stuck');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('does not truncate grouped weekly summaries to the first 12 discussions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-03T12:00:00.000Z'));

    const createdDates = [
      '2026-02-24T08:00:00.000Z',
      '2026-02-24T09:00:00.000Z',
      '2026-02-25T08:00:00.000Z',
      '2026-02-25T09:00:00.000Z',
      '2026-02-26T08:00:00.000Z',
      '2026-02-26T09:00:00.000Z',
      '2026-02-27T08:00:00.000Z',
      '2026-02-27T09:00:00.000Z',
      '2026-02-28T08:00:00.000Z',
      '2026-03-01T08:00:00.000Z',
      '2026-03-01T09:00:00.000Z',
      '2026-03-02T08:00:00.000Z',
      '2026-03-03T08:00:00.000Z',
    ];
    const discussions = Array.from({ length: 13 }, (_, index) => ({
      id: `D_${700 + index}`,
      number: 700 + index,
      title: `Customer Support Thread ${index + 1}`,
      url: `https://github.com/ajitgunturi/forge/discussions/${700 + index}`,
      createdAt: createdDates[index]!,
      updatedAt: createdDates[index]!.replace('08:00:00.000Z', '09:00:00.000Z').replace('09:00:00.000Z', '10:00:00.000Z'),
      answerChosenAt: null,
      author: 'ajitg',
      category: { id: 'cat1', name: 'Customer Support', slug: 'customer-support' },
      bodyText: `Support discussion ${index + 1}.`,
      commentsCount: 2,
      comments: [],
      upvoteCount: 1,
    }));

    const run = {
      version: '1.0' as const,
      id: '2026-03-03T14-00-00-000Z',
      timestamp: '2026-03-03T14:00:00.000Z',
      repository: {
        owner: 'ajitgunturi',
        name: 'forge',
        remoteUrl: 'https://github.com/ajitgunturi/forge.git',
      },
      filters: normalizeDiscussionFilters({ when: 'last-week', limit: 100 }),
      pageInfo: {
        hasNextPage: false,
        endCursor: null,
        fetchedPages: 1,
      },
      discussionCount: discussions.length,
      discussions,
    };

    const fetchSpy = mockAnalyzerFetch(run);

    try {
      const answer = await runDiscussionAnalyzer({
        cwd: tempDir,
        question: 'show me all discussions from the last week grouped by category, including all categories',
        refreshAnalysis: true,
      });

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(answer).toContain('| Customer Support | 13 |');
      expect(answer).toContain('### Customer Support Thread 13 (#712)');
    } finally {
      fetchSpy.mockRestore();
      vi.useRealTimers();
    }
  });
});
