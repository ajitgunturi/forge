import { PRReviewFilters } from '../../contracts/pr-reviews.js';
import { UserFacingError } from '../../lib/errors.js';

export interface PRReviewFilterInput {
  when?: string;
  after?: string;
  before?: string;
  pr?: number;
  reviewer?: string;
  dateField?: 'createdAt' | 'updatedAt';
  limit?: number;
  now?: Date;
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function normalizePRReviewFilters(input: PRReviewFilterInput = {}): PRReviewFilters {
  const now = input.now ?? new Date();
  const limit = normalizeLimit(input.limit);
  const filters: PRReviewFilters = {
    dateField: input.dateField ?? 'createdAt',
    limit,
  };

  if (input.pr !== undefined) {
    if (!Number.isInteger(input.pr) || input.pr <= 0) {
      throw new UserFacingError('PR number must be a positive integer.');
    }
    filters.pr = input.pr;
  }

  if (input.reviewer?.trim()) {
    filters.reviewer = input.reviewer.trim();
  }

  if (input.when) {
    const when = input.when.trim().toLowerCase();
    switch (when) {
      case 'today':
        filters.when = 'today';
        filters.after = startOfDay(now).toISOString();
        filters.before = now.toISOString();
        break;
      case 'yesterday': {
        filters.when = 'yesterday';
        const yesterday = new Date(startOfDay(now).getTime() - DAY_IN_MS);
        filters.after = yesterday.toISOString();
        filters.before = startOfDay(now).toISOString();
        break;
      }
      case 'last week':
      case 'last-week':
      case 'last_week':
      case 'last 1 week':
      case 'in the last week':
      case 'in the last 1 week':
      case 'past week':
      case 'past 1 week':
      case 'last 7 days':
      case 'past 7 days':
        filters.when = 'last-week';
        filters.after = startOfDay(new Date(now.getTime() - (7 * DAY_IN_MS))).toISOString();
        filters.before = now.toISOString();
        break;
      default:
        throw new UserFacingError(
          `Unsupported --when value "${input.when}". Use today, yesterday, or last-week.`,
        );
    }
  }

  if (input.after) {
    filters.after = normalizeDateBoundary(input.after, 'start');
  }

  if (input.before) {
    filters.before = normalizeDateBoundary(input.before, 'end');
  }

  if (filters.after && filters.before && new Date(filters.after) > new Date(filters.before)) {
    throw new UserFacingError('The PR review filter "after" date must be earlier than or equal to "before".');
  }

  return filters;
}

export function matchesPRReviewWindow(timestampValue: string, filters: PRReviewFilters): boolean {
  const timestamp = new Date(timestampValue).getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  if (filters.after && timestamp < new Date(filters.after).getTime()) {
    return false;
  }

  if (filters.before && timestamp > new Date(filters.before).getTime()) {
    return false;
  }

  return true;
}

function normalizeLimit(limit?: number): number {
  if (limit === undefined) {
    return 500;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 5000) {
    throw new UserFacingError('PR review fetch limit must be an integer between 1 and 5000.');
  }

  return limit;
}

function normalizeDateBoundary(raw: string, mode: 'start' | 'end'): string {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    if (mode === 'end') {
      date.setUTCHours(23, 59, 59, 999);
    }
    return date.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new UserFacingError(`Invalid date value "${raw}". Use YYYY-MM-DD or a valid ISO timestamp.`);
  }

  return parsed.toISOString();
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}
