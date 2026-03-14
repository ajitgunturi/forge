import { Command, Option } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAssistantsCommand } from "./commands/install-assistants.js";
import { runDiscussionAnalyzer } from "./services/discussions/analyze.js";
import { runIssueAnalyzer } from "./services/issues/analyze.js";
import { runPRReviewAnalyzer } from "./services/pr-reviews/analyze.js";
import { AssistantId } from "./contracts/assistants.js";

type PackageManifest = {
  name?: string;
  description?: string;
  version?: string;
};

type ProgramOptions = {
  cwd: string;
  verbose?: boolean;
  assistants?: string;
  run?: string;
  runSummonable?: string;
  question?: string;
  refreshAnalysis?: boolean;
  forceRefresh?: boolean;
  githubToken?: string;
  when?: string;
  after?: string;
  before?: string;
  category?: string;
  issueState?: string;
  label?: string;
  discussionLimit?: string;
  pr?: string;
  reviewer?: string;
};

const EXECUTABLE_NAME = "forge";
const ANALYZER_IDS = ["forge-discussion-analyzer", "forge-issue-analyzer", "forge-pr-review-analyzer"] as const;
type AnalyzerId = (typeof ANALYZER_IDS)[number];

async function readPackageManifest(): Promise<PackageManifest> {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const manifestPath = fileURLToPath(manifestUrl);
  const manifest = await readFile(manifestPath, "utf8");

  return JSON.parse(manifest) as PackageManifest;
}

export async function createProgram(): Promise<Command> {
  const manifest = await readPackageManifest();
  const program = new Command();

  program
    .name(EXECUTABLE_NAME)
    .description("Install Forge assistant assets for Copilot, Claude, Codex, and Gemini, and run Forge-managed GitHub discussion and issue workflows.")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .option("--verbose", "Show detailed installer update output.")
    .option("--assistants <targets>", "Install assistant assets for: all, copilot, claude, codex, or gemini.")
    .option("--run <analyzer>", "Run a Forge-managed analyzer.")
    .option("--question <text>", "Question or request for Forge-managed assistant execution.")
    .option("--refresh-analysis", "Re-run the live discussion analysis before answering.")
    .option("--force-refresh", "Compatibility flag. Forge analyzers already fetch live on every run.")
    .option("--github-token <token>", "Explicit GitHub token override for analyzer fetches.")
    .option("--when <window>", "Relative analyzer window: today, yesterday, or last-week.")
    .option("--after <date>", "Only include analyzer records created on or after this date by default.")
    .option("--before <date>", "Only include analyzer records created on or before this date by default.")
    .option("--category <name>", "Filter discussions by GitHub discussion category name or slug.")
    .option("--issue-state <state>", "Issue state filter: open, closed, or all.")
    .option("--label <name>", "Filter issues by GitHub issue label.")
    .option("--discussion-limit <number>", "Maximum number of discussions to persist (1-5000).", "500")
    .option("--pr <number>", "PR number to analyze. If omitted, detects from the current branch.")
    .option("--reviewer <username>", "Filter PR review comments by reviewer username.")
    .addOption(new Option("--run-summonable <id>", "Run a Forge-managed assistant backend directly.").hideHelp())
    .hook("preAction", (thisCommand) => {
      const options = thisCommand.opts();
      if (options.cwd && options.cwd !== process.cwd()) {
        process.chdir(options.cwd);
      }
    })
    .showHelpAfterError("(run with --help for usage)");

  program.action(async (options: ProgramOptions) => {
    const requestedAnalyzer = options.run ?? options.runSummonable;

    if (requestedAnalyzer) {
      const parsedAnalyzer = parseAnalyzerId(requestedAnalyzer);
      const sharedOptions = {
        cwd: options.cwd,
        question: options.question ?? '',
        forceRefresh: options.forceRefresh,
        refreshAnalysis: options.refreshAnalysis,
        token: options.githubToken,
        when: options.when,
        after: options.after,
        before: options.before,
        limit: Number.parseInt(options.discussionLimit ?? "500", 10),
      };
      let answer: string;
      if (parsedAnalyzer === "forge-discussion-analyzer") {
        answer = await runDiscussionAnalyzer({
          ...sharedOptions,
          category: options.category,
        });
      } else if (parsedAnalyzer === "forge-pr-review-analyzer") {
        answer = await runPRReviewAnalyzer({
          ...sharedOptions,
          pr: options.pr ? Number.parseInt(options.pr, 10) : undefined,
          reviewer: options.reviewer,
        });
      } else {
        answer = await runIssueAnalyzer({
          ...sharedOptions,
          state: options.issueState,
          label: options.label,
        });
      }
      console.log(answer);
      return;
    }

    await installAssistantsCommand(options.cwd, {
      verbose: options.verbose,
      assistants: parseAssistantSelection(options.assistants),
      version: manifest.version ?? "0.0.0",
    });
  });

  return program;
}

function parseAnalyzerId(value: string): AnalyzerId {
  if ((ANALYZER_IDS as readonly string[]).includes(value)) {
    return value as AnalyzerId;
  }

  throw new Error(`Unknown analyzer "${value}". Available analyzers: ${ANALYZER_IDS.join(', ')}.`);
}

function parseAssistantSelection(value?: string): AssistantId[] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'all':
      return ['copilot', 'claude', 'codex', 'gemini'];
    case 'copilot':
      return ['copilot'];
    case 'claude':
      return ['claude'];
    case 'codex':
      return ['codex'];
    case 'gemini':
      return ['gemini'];
    default:
      throw new Error(`Unknown assistant target "${value}". Use one of: all, copilot, claude, codex, gemini.`);
  }
}
