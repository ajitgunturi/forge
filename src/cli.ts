#!/usr/bin/env node

import { createProgram } from "./program.js";
import { UserFacingError } from "./lib/errors.js";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { refreshIfOutdated } from "./services/self-refresh.js";

async function readCurrentVersion(): Promise<string> {
  const manifestUrl = new URL("../package.json", import.meta.url);
  const manifestPath = fileURLToPath(manifestUrl);
  const manifestRaw = await readFile(manifestPath, "utf8");
  const manifest = JSON.parse(manifestRaw) as { version?: string };
  return manifest.version ?? "0.0.0";
}

async function main(): Promise<void> {
  const currentVersion = await readCurrentVersion();
  await refreshIfOutdated(currentVersion, process.argv, process.env);
  const program = await createProgram();
  await program.parseAsync(process.argv);
}

try {
  await main();
} catch (error) {
  if (error instanceof UserFacingError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
