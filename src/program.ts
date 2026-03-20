import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAssistantsCommand } from "./commands/install-assistants.js";
import { uninstallAssistantsCommand } from "./commands/uninstall-assistants.js";
import { AssistantId } from "./contracts/assistants.js";
import { PluginGroup, PLUGIN_GROUPS } from "./services/assistants/summonables.js";

type PackageManifest = {
  name?: string;
  description?: string;
  version?: string;
};

type ProgramOptions = {
  cwd: string;
  verbose?: boolean;
  assistants?: string;
  plugins?: string;
  uninstall?: boolean;
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
    .description("Install or remove Forge assistant assets for Copilot, Claude, Codex, and Gemini.")
    .version(manifest.version ?? "0.0.0", "-v, --version", "output the current version")
    .option("--cwd <path>", "The working directory to run the command in.", process.cwd())
    .option("--verbose", "Show detailed installer update output.")
    .option("--assistants <targets>", "Install or remove assistant assets for: all, copilot, claude, codex, or gemini.")
    .option("--plugins <group>", "Plugin group to install: core (default), elevate, or all.")
    .option("--uninstall", "Remove Forge assistant assets instead of installing them.")
    .hook("preAction", (thisCommand) => {
      const options = thisCommand.opts();
      if (options.cwd && options.cwd !== process.cwd()) {
        process.chdir(options.cwd);
      }
    })
    .showHelpAfterError("(run with --help for usage)");

  program.action(async (options: ProgramOptions) => {
    const assistantSelection = parseAssistantSelection(options.assistants);
    const pluginSelection = parsePluginSelection(options.plugins);

    if (options.uninstall) {
      await uninstallAssistantsCommand(options.cwd, {
        verbose: options.verbose,
        assistants: assistantSelection,
        pluginGroups: pluginSelection,
      });
      return;
    }

    await installAssistantsCommand(options.cwd, {
      verbose: options.verbose,
      assistants: assistantSelection,
      pluginGroups: pluginSelection,
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

function parsePluginSelection(value?: string): PluginGroup[] | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'core':
      return ['core'];
    case 'elevate':
      return ['elevate'];
    case 'all':
      return [...PLUGIN_GROUPS];
    default:
      throw new Error(`Unknown plugin group "${value}". Use one of: core, elevate, all.`);
  }
}
