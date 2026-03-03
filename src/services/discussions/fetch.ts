import {
  DiscussionCategory,
  DiscussionCommentRecord,
  DiscussionFilters,
  DiscussionRecord,
  GitHubRepositoryRef,
} from '../../contracts/discussions.js';
import { GitHubDiscussionsFetchError } from '../../lib/errors.js';
import { matchesDiscussionWindow } from './filters.js';

const DISCUSSIONS_QUERY = `
  query ForgeRepositoryDiscussions(
    $owner: String!,
    $name: String!,
    $first: Int!,
    $after: String,
    $categoryId: ID,
    $orderField: DiscussionOrderField!
  ) {
    repository(owner: $owner, name: $name) {
      discussionCategories(first: 25) {
        nodes {
          id
          name
          slug
        }
      }
      discussions(first: $first, after: $after, categoryId: $categoryId, orderBy: { field: $orderField, direction: DESC }) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          number
          title
          url
          createdAt
          updatedAt
          answerChosenAt
          bodyText
          upvoteCount
          author {
            login
          }
          category {
            id
            name
            slug
          }
          comments(first: 100) {
            totalCount
            nodes {
              body
              bodyText
              createdAt
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`;

const GITHUB_DISCUSSIONS_PAGE_SIZE = 100;

interface RepositoryDiscussionsResponse {
  repository: {
    discussionCategories: {
      nodes: DiscussionCategory[];
    };
    discussions: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor?: string | null;
      };
      nodes: Array<{
        id: string;
        number: number;
        title: string;
        url: string;
        createdAt: string;
        updatedAt: string;
        answerChosenAt?: string | null;
        bodyText: string;
        upvoteCount: number;
        author?: { login?: string | null } | null;
        category: DiscussionCategory;
        comments: {
          totalCount: number;
          nodes: Array<{
            body?: string | null;
            bodyText?: string | null;
            createdAt: string;
            author?: { login?: string | null } | null;
          }>;
        };
      }>;
    };
  } | null;
}

export interface FetchGitHubDiscussionsOptions {
  repository: GitHubRepositoryRef;
  token: string;
  filters: DiscussionFilters;
}

export interface FetchGitHubDiscussionsResult {
  discussions: DiscussionRecord[];
  categories: DiscussionCategory[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string | null;
    fetchedPages: number;
  };
  resolvedCategory?: DiscussionCategory;
}

export async function fetchGitHubDiscussions(
  options: FetchGitHubDiscussionsOptions
): Promise<FetchGitHubDiscussionsResult> {
  const categories = await fetchDiscussionCategories(options.repository, options.token);
  const resolvedCategory = resolveCategoryFilter(categories, options.filters.category);
  const collected: DiscussionRecord[] = [];
  let afterCursor: string | null | undefined;
  let hasNextPage = true;
  let fetchedPages = 0;

  while (hasNextPage && collected.length < options.filters.limit) {
    fetchedPages += 1;
    const remaining = options.filters.limit - collected.length;
    const response = await executeGitHubGraphQL<RepositoryDiscussionsResponse>(options.token, {
      owner: options.repository.owner,
      name: options.repository.name,
      first: Math.min(GITHUB_DISCUSSIONS_PAGE_SIZE, remaining),
      after: afterCursor,
      categoryId: resolvedCategory?.id ?? null,
      orderField: toGraphQLOrderField(options.filters.dateField),
    });

    const repository = response.repository;
    if (!repository) {
      throw new GitHubDiscussionsFetchError(
        `GitHub could not find repository ${options.repository.owner}/${options.repository.name}.`
      );
    }

    const normalized = repository.discussions.nodes
      .map((discussion): DiscussionRecord => ({
        id: discussion.id,
        number: discussion.number,
        title: discussion.title,
        url: discussion.url,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        answerChosenAt: discussion.answerChosenAt ?? null,
        author: discussion.author?.login ?? undefined,
        category: discussion.category,
        bodyText: discussion.bodyText,
        commentsCount: discussion.comments.totalCount,
        comments: discussion.comments.nodes.map(normalizeCommentNode),
        upvoteCount: discussion.upvoteCount,
      }))
      .filter((discussion) => matchesDiscussionWindow(discussion[options.filters.dateField], options.filters));

    collected.push(...normalized);

    hasNextPage = repository.discussions.pageInfo.hasNextPage;
    afterCursor = repository.discussions.pageInfo.endCursor;

    if (options.filters.after) {
      const oldestSeen = repository.discussions.nodes.at(-1)?.[options.filters.dateField];
      if (oldestSeen && new Date(oldestSeen) < new Date(options.filters.after)) {
        break;
      }
    }
  }

  return {
    discussions: collected.slice(0, options.filters.limit),
    categories,
    pageInfo: {
      hasNextPage,
      endCursor: afterCursor,
      fetchedPages,
    },
    resolvedCategory,
  };
}

function normalizeCommentNode(node: {
  body?: string | null;
  bodyText?: string | null;
  createdAt: string;
  author?: { login?: string | null } | null;
}): DiscussionCommentRecord {
  return {
    body: node.body ?? undefined,
    bodyText: node.bodyText ?? node.body ?? '',
    author: node.author?.login ?? undefined,
    createdAt: node.createdAt,
  };
}

async function fetchDiscussionCategories(
  repository: GitHubRepositoryRef,
  token: string
): Promise<DiscussionCategory[]> {
  const response = await executeGitHubGraphQL<RepositoryDiscussionsResponse>(token, {
    owner: repository.owner,
    name: repository.name,
    first: 1,
    after: null,
    categoryId: null,
    orderField: 'UPDATED_AT',
  });

  return response.repository?.discussionCategories.nodes ?? [];
}

function toGraphQLOrderField(dateField: DiscussionFilters['dateField']): 'CREATED_AT' | 'UPDATED_AT' {
  return dateField === 'createdAt' ? 'CREATED_AT' : 'UPDATED_AT';
}

async function executeGitHubGraphQL<T>(token: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query: DISCUSSIONS_QUERY,
      variables,
    }),
  });

  const payload = await response.json() as {
    data?: T;
    errors?: Array<{ message: string }>;
    message?: string;
  };

  if (!response.ok) {
    throw new GitHubDiscussionsFetchError(
      payload.message || payload.errors?.map((error) => error.message).join('; ') || 'GitHub discussions request failed.'
    );
  }

  if (payload.errors && payload.errors.length > 0) {
    throw new GitHubDiscussionsFetchError(payload.errors.map((error) => error.message).join('; '));
  }

  if (!payload.data) {
    throw new GitHubDiscussionsFetchError('GitHub discussions request returned no data.');
  }

  return payload.data;
}

function resolveCategoryFilter(
  categories: DiscussionCategory[],
  categoryFilter?: string
): DiscussionCategory | undefined {
  if (!categoryFilter) {
    return undefined;
  }

  const normalized = categoryFilter.trim().toLowerCase();
  const match = categories.find((category) => {
    return category.slug.toLowerCase() === normalized || category.name.toLowerCase() === normalized;
  });

  if (!match) {
    throw new GitHubDiscussionsFetchError(
      `Discussion category "${categoryFilter}" was not found in the current repository.`
    );
  }

  return match;
}
