import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAssistantsCommand } from "./commands/install-assistants.js";
import { runDiscussionAnalyzer } from "./services/discussions/analyze.js";
import { runDiscussionFetch } from "./services/discussions/run.js";

type PackageManifest = {
  name?: string;
  description?: string;
  version?: string;
};

type ProgramOptions = {
  cwd: string;
  fetchDiscussions?: boolean;
  runSummonable?: string;
  question?: string;
  refreshAnalysis?: boolean;
  githubToken?: string;
  when?: string;
  after?: string;
  before?: string;
  category?: string;
  discussionLimit?: string;
};

const EXECUTABLE_NAME = "forge";

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
    .description("Install the Forge Copilot runtime into ~/.copilot and run Forge-managed GitHub discussion workflows.")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .option("--fetch-discussions", "Fetch GitHub Discussions for the current repository into .forge/discussions.")
    .option("--run-summonable <id>", "Run a Forge-managed summonable backend directly.")
    .option("--question <text>", "Question or request for Forge-managed summonable execution.")
    .option("--refresh-analysis", "Rebuild compact discussion-analysis artifacts before answering.")
    .option("--github-token <token>", "Explicit GitHub token override for discussions fetches.")
    .option("--when <window>", "Relative discussions window: today, yesterday, or last-week.")
    .option("--after <date>", "Only include discussions updated on or after this date.")
    .option("--before <date>", "Only include discussions updated on or before this date.")
    .option("--category <name>", "Filter discussions by GitHub discussion category name or slug.")
    .option("--discussion-limit <number>", "Maximum number of discussions to persist (1-100).", "25")
    .hook("preAction", (thisCommand) => {
      const options = thisCommand.opts();
      if (options.cwd && options.cwd !== process.cwd()) {
        process.chdir(options.cwd);
      }
    })
    .showHelpAfterError("(run with --help for usage)");

  program.action(async (options: ProgramOptions) => {
    if (options.runSummonable === 'forge-discussion-analyzer') {
      const answer = await runDiscussionAnalyzer({
        cwd: options.cwd,
        question: options.question ?? '',
        refresh: options.refreshAnalysis,
      });
      console.log(answer);
      return;
    }

    if (options.fetchDiscussions) {
      const run = await runDiscussionFetch({
        cwd: options.cwd,
        token: options.githubToken,
        when: options.when,
        after: options.after,
        before: options.before,
        category: options.category,
        limit: Number.parseInt(options.discussionLimit ?? "25", 10),
      });

      console.log(`Fetched ${run.discussionCount} discussions for ${run.repository.owner}/${run.repository.name}.`);
      console.log('Artifacts written to .forge/discussions/latest.json and .forge/discussions/latest.md');
      return;
    }

    await installAssistantsCommand(options.cwd);
  });

  return program;
}
