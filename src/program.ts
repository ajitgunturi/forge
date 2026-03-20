import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAssistantsCommand } from "./commands/install-assistants.js";
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
    .description("Install Forge assistant assets for Copilot, Claude, Codex, and Gemini.")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .option("--verbose", "Show detailed installer update output.")
    .option("--assistants <targets>", "Install assistant assets for: all, copilot, claude, codex, or gemini.")
    .hook("preAction", (thisCommand) => {
      const options = thisCommand.opts();
      if (options.cwd && options.cwd !== process.cwd()) {
        process.chdir(options.cwd);
      }
    })
    .showHelpAfterError("(run with --help for usage)");

  program.action(async (options: ProgramOptions) => {
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
