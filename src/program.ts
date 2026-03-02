import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { UserFacingError } from "./lib/errors.js";
import { bootstrapCommand } from "./commands/bootstrap.js";
import { analyzeCommand } from "./commands/analyze.js";
import { planCommand } from "./commands/plan.js";
import { installCopilotCommand } from "./commands/install-copilot.js";

type PackageManifest = {
  name?: string;
  description?: string;
  version?: string;
};

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
    .name(manifest.name ?? "forge-ai-assist")
    .description(manifest.description ?? "Forge AI Assist CLI")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .hook("preAction", (thisCommand) => {
      const options = thisCommand.opts();
      if (options.cwd && options.cwd !== process.cwd()) {
        process.chdir(options.cwd);
      }
    })
    .showHelpAfterError("(run with --help for usage)");

  program
    .command("bootstrap")
    .description("Initialize or update the Forge sidecar in the current repository.")
    .action(async () => {
      await bootstrapCommand();
    });

  program
    .command("analyze")
    .description("Analyze the repository to identify facts and recommendations.")
    .action(async () => {
      await analyzeCommand();
    });

  program
    .command("plan")
    .description("Generate an end-to-end action plan for a task.")
    .option("--task <description>", "The task to plan for.")
    .option("--context <identifier>", "A context identifier, such as a discussion ID.")
    .action(async (options) => {
      await planCommand(options);
    });

  program
    .command("install-copilot")
    .description("Expose the GitHub Copilot /agent entrypoint for the repository.")
    .action(async (options) => {
      const opts = program.opts();
      await installCopilotCommand(opts.cwd);
    });

  program.action(async () => {
    program.outputHelp();
  });

  return program;
}
