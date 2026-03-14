import {
  PRReviewRun,
  PreparedPRReviewDigest,
  PreparedComment,
  CommentCategory,
  PRReviewComment,
} from '../../contracts/pr-reviews.js';

export function buildPreparedPRReviewDigest(run: PRReviewRun): PreparedPRReviewDigest {
  const allComments = [
    ...run.pr.reviewComments,
    ...run.pr.issueComments,
  ];

  const comments = allComments.map((comment) => buildPreparedComment(comment));

  const categories = countBy(comments.map((c) => c.category));
  const severities = countBy(comments.map((c) => c.severity));
  const reviewers = countBy(comments.map((c) => c.author));
  const filesCommented = countBy(
    comments.filter((c) => c.path).map((c) => c.path!),
  );

  return {
    version: '1.0',
    id: `${run.id}-analysis`,
    sourceRunId: run.id,
    timestamp: new Date().toISOString(),
    repository: run.repository,
    filters: run.filters,
    pr: {
      number: run.pr.number,
      title: run.pr.title,
      url: run.pr.url,
      state: run.pr.state,
      author: run.pr.author,
      branch: run.pr.branch,
      baseBranch: run.pr.baseBranch,
      additions: run.pr.additions,
      deletions: run.pr.deletions,
      changedFiles: run.pr.changedFiles,
    },
    totals: {
      comments: comments.length,
      categories,
      severities,
      reviewers,
      filesCommented,
    },
    comments,
  };
}

function buildPreparedComment(comment: PRReviewComment): PreparedComment {
  const body = comment.body.trim();
  const searchableText = `${body} ${comment.path ?? ''} ${comment.author}`.toLowerCase();
  const category = classifyCategory(body, searchableText);
  const severity = classifySeverity(body, category);
  const suggestedFix = extractSuggestedFix(body, comment.diffHunk, category);

  return {
    id: comment.id,
    author: comment.author,
    body,
    path: comment.path,
    line: comment.line,
    diffHunk: comment.diffHunk,
    createdAt: comment.createdAt,
    category,
    severity,
    suggestedFix,
    searchableText,
  };
}

function classifyCategory(body: string, searchableText: string): CommentCategory {
  const lower = searchableText;

  if (/\b(lgtm|looks good|approved?|ship it)\b/i.test(body)) return 'approval';
  if (/\b(security|vulnerab|inject|xss|csrf|auth|secret|credential|token leak)\b/.test(lower)) return 'security';
  if (/\b(bug|incorrect|wrong|broken|error|crash|exception|undefined|null pointer|off[- ]by[- ]one)\b/.test(lower)) return 'bug';
  if (/\b(perf|performance|slow|optimize|memory|leak|cache|latency|n\+1|o\(n)\b/.test(lower)) return 'performance';
  if (/\b(logic|condition|edge case|boundary|off by|race condition|deadlock|concurren)\b/.test(lower)) return 'logic';
  if (/\b(test|spec|coverage|assert|mock|fixture|expect)\b/.test(lower)) return 'testing';
  if (/\b(refactor|extract|simplif|abstract|duplic|dry|clean|decompose)\b/.test(lower)) return 'refactor';
  if (/\b(naming|rename|variable name|method name|typo|spell|misleading name)\b/.test(lower)) return 'naming';
  if (/\b(style|format|indent|whitespace|lint|spacing|brace|semicolon|trailing)\b/.test(lower)) return 'style';
  if (/\b(doc|comment|readme|jsdoc|docstring|description|explain)\b/.test(lower)) return 'documentation';
  if (/\b(nit|nitpick|minor|optional|suggestion|consider|could also)\b/.test(lower)) return 'nitpick';
  if (/\?/.test(body) && body.length < 200) return 'question';
  return 'general';
}

function classifySeverity(
  body: string,
  category: CommentCategory,
): PreparedComment['severity'] {
  if (category === 'approval' || category === 'nitpick') return 'informational';
  if (category === 'style' || category === 'documentation' || category === 'naming') return 'minor';
  if (category === 'question') return 'informational';

  const lower = body.toLowerCase();
  if (/\b(critical|blocker|must fix|breaking|security|vulnerab)\b/.test(lower)) return 'critical';
  if (/\b(bug|incorrect|wrong|error|crash|broken)\b/.test(lower)) return 'major';
  if (/\b(nit|optional|consider|minor|could)\b/.test(lower)) return 'minor';

  if (category === 'security' || category === 'bug') return 'major';
  if (category === 'performance' || category === 'logic') return 'major';
  if (category === 'refactor' || category === 'testing') return 'minor';

  return 'minor';
}

function extractSuggestedFix(
  body: string,
  diffHunk: string | undefined,
  category: CommentCategory,
): string | undefined {
  // Extract code suggestion blocks (GitHub suggestion syntax)
  const suggestionMatch = body.match(/```suggestion\n([\s\S]*?)```/);
  if (suggestionMatch) {
    return suggestionMatch[1]!.trim();
  }

  // Extract inline code fixes
  const inlineCodeMatch = body.match(/(?:should be|change to|replace with|use)\s+`([^`]+)`/i);
  if (inlineCodeMatch) {
    return inlineCodeMatch[1]!.trim();
  }

  if (category === 'approval' || category === 'question') {
    return undefined;
  }

  // Derive a fix suggestion from the comment content and diff context
  if (diffHunk && body.length > 20) {
    return deriveFix(body, diffHunk);
  }

  return undefined;
}

function deriveFix(body: string, diffHunk: string): string | undefined {
  const lines = body.split('\n').filter((line) => line.trim().length > 0);
  const actionLine = lines.find((line) =>
    /\b(should|change|replace|use|rename|move|extract|remove|add|wrap|return|throw)\b/i.test(line),
  );

  if (!actionLine) {
    return undefined;
  }

  // Get the most relevant added line from the diff hunk for context
  const addedLines = diffHunk
    .split('\n')
    .filter((line) => line.startsWith('+') && !line.startsWith('+++'))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length > 0);

  const targetLine = addedLines.at(-1);
  if (targetLine) {
    return `${actionLine.trim()} (at: \`${truncate(targetLine, 80)}\`)`;
  }

  return actionLine.trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 3).trimEnd()}...`;
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
