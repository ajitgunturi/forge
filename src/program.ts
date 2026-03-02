import { Command } from "commander";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { UserFacingError } from "./lib/errors.js";
import { bootstrapCommand } from "./commands/bootstrap.js";
import { analyzeCommand } from "./commands/analyze.js";

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

  program.action(async () => {
    program.outputHelp();
  });

  return program;
}
