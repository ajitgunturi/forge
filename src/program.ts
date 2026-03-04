import { Command, Option } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAssistantsCommand } from "./commands/install-assistants.js";
import { runDiscussionAnalyzer } from "./services/discussions/analyze.js";
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
  discussionLimit?: string;
};

const EXECUTABLE_NAME = "forge";
const DEFAULT_ANALYZER_ID = "forge-discussion-analyzer";

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
    .description("Install Forge assistant assets for Copilot, Claude, Codex, and Gemini, and run Forge-managed GitHub discussion workflows.")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .option("--verbose", "Show detailed installer update output.")
    .option("--assistants <targets>", "Install assistant assets for: all, copilot, claude, codex, or gemini.")
    .option("--run <analyzer>", "Run a Forge-managed analyzer.")
    .option("--question <text>", "Question or request for Forge-managed assistant execution.")
    .option("--refresh-analysis", "Re-run the live discussion analysis before answering.")
    .option("--force-refresh", "Compatibility flag. The discussion analyzer already fetches live on every run.")
    .option("--github-token <token>", "Explicit GitHub token override for discussions fetches.")
    .option("--when <window>", "Relative discussions window: today, yesterday, or last-week.")
    .option("--after <date>", "Only include discussions created on or after this date by default.")
    .option("--before <date>", "Only include discussions created on or before this date by default.")
    .option("--category <name>", "Filter discussions by GitHub discussion category name or slug.")
    .option("--discussion-limit <number>", "Maximum number of discussions to persist (1-5000).", "500")
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
      if (requestedAnalyzer !== DEFAULT_ANALYZER_ID) {
        throw new Error(`Unknown analyzer "${requestedAnalyzer}". The available analyzer is ${DEFAULT_ANALYZER_ID}.`);
      }

      const answer = await runDiscussionAnalyzer({
        cwd: options.cwd,
        question: options.question ?? '',
        forceRefresh: options.forceRefresh,
        refreshAnalysis: options.refreshAnalysis,
        token: options.githubToken,
        when: options.when,
        after: options.after,
        before: options.before,
        category: options.category,
        limit: Number.parseInt(options.discussionLimit ?? "500", 10),
      });
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
