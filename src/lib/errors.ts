export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Thrown when a command is run outside of a Git repository but requires one.
 */
export class RepositoryRequiredError extends UserFacingError {
  constructor(message = "Not in a Git repository. Forge repository flows must be run inside a Git repository.") {
    super(message);
    this.name = "RepositoryRequiredError";
  }
}

/**
 * Thrown when a subprocess (like Git) fails in a way that should be user-visible.
 */
export class SubprocessError extends UserFacingError {
  constructor(message: string, public readonly exitCode?: number, public readonly command?: string) {
    super(message);
    this.name = "SubprocessError";
  }
}

/**
 * Thrown when a plan is requested but no repository analysis exists.
 */
export class AnalysisRequiredError extends UserFacingError {
  constructor(message = 'No repository analysis found. Please run "forge analyze" before generating a plan.') {
    super(message);
    this.name = "AnalysisRequiredError";
  }
}

export class UnsupportedGitHubRemoteError extends UserFacingError {
  constructor(message = 'Forge could not derive a GitHub owner/repo from the current origin remote.') {
    super(message);
    this.name = 'UnsupportedGitHubRemoteError';
  }
}

export class GitHubTokenRequiredError extends UserFacingError {
  constructor(
    message = 'Missing GitHub token. Export GH_TOKEN or GITHUB_TOKEN in your shell, then retry the discussions fetch.'
  ) {
    super(message);
    this.name = 'GitHubTokenRequiredError';
  }
}

export class GitHubDiscussionsFetchError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubDiscussionsFetchError';
  }
}

export class GitHubIssuesFetchError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubIssuesFetchError';
  }
}

export class DiscussionArtifactsRequiredError extends UserFacingError {
  constructor(
    message = 'No discussion artifacts found. Fetch discussions first with Forge before running forge-discussion-analyzer.'
  ) {
    super(message);
    this.name = 'DiscussionArtifactsRequiredError';
  }
}

export class DiscussionsOnlyAnalyzerError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'DiscussionsOnlyAnalyzerError';
  }
}

export class IssueArtifactsRequiredError extends UserFacingError {
  constructor(
    message = 'No issue artifacts found. Fetch issues first with Forge before running forge-issue-analyzer.'
  ) {
    super(message);
    this.name = 'IssueArtifactsRequiredError';
  }
}

export class IssuesOnlyAnalyzerError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'IssuesOnlyAnalyzerError';
  }
}

export class PRReviewsOnlyAnalyzerError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = 'PRReviewsOnlyAnalyzerError';
  }
}
