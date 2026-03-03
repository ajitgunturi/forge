#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { rmSync } from "node:fs";

function parseArgs(argv) {
  const args = {
    publish: false,
    tag: undefined,
    otp: undefined,
    allowDirty: false,
    keepTarball: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (value === "--publish") {
      args.publish = true;
      continue;
    }

    if (value === "--allow-dirty") {
      args.allowDirty = true;
      continue;
    }

    if (value === "--keep-tarball") {
      args.keepTarball = true;
      continue;
    }

    if (value === "--tag") {
      args.tag = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--otp") {
      args.otp = argv[index + 1];
      index += 1;
      continue;
    }

    if (value === "--help" || value === "-h") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function printHelp() {
  console.log(`Usage: npm run release:local -- [options]

Options:
  --publish       Publish the packed tarball to npm after validation
  --tag <name>    Publish under a dist-tag such as latest or next
  --otp <code>    Pass a one-time password to npm publish
  --allow-dirty   Skip the clean git worktree check
  --keep-tarball  Keep the generated .tgz artifact after the script exits
  -h, --help      Show this help message
`);
}

function run(command, args, options = {}) {
  const display = [command, ...args].join(" ");
  console.log(`\n$ ${display}`);
  return execFileSync(command, args, {
    stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    encoding: options.capture ? "utf8" : undefined,
  });
}

function ensureCleanWorktree() {
  const output = run("git", ["status", "--short"], { capture: true }).trim();
  if (output.length > 0) {
    throw new Error("Git worktree must be clean before running a release. Commit or stash your changes, or rerun with --allow-dirty.");
  }
}

function ensureNpmAuth() {
  try {
    const username = run("npm", ["whoami"], { capture: true }).trim();
    if (!username) {
      throw new Error("Missing npm username.");
    }
    console.log(`npm auth ok: ${username}`);
  } catch {
    throw new Error("npm authentication is required. Run `npm login` on this machine before releasing.");
  }
}

function packArtifact() {
  const output = run("npm", ["pack", "--json"], { capture: true }).trim();
  const parsed = JSON.parse(output);
  const artifact = Array.isArray(parsed) ? parsed[0] : parsed;

  if (!artifact?.filename) {
    throw new Error("npm pack did not return a tarball filename.");
  }

  console.log(`Packed artifact: ${artifact.filename}`);
  return artifact.filename;
}

function publishArtifact(filename, args) {
  const publishArgs = ["publish", filename, "--access", "public"];

  if (args.tag) {
    publishArgs.push("--tag", args.tag);
  }

  if (args.otp) {
    publishArgs.push("--otp", args.otp);
  }

  run("npm", publishArgs);
}

function printNextSteps(args, filename) {
  console.log("\nRelease checks passed.");
  console.log(`Tarball verified: ${filename}`);

  if (args.publish) {
    console.log("npm publish completed.");
    console.log("Recommended follow-up: push the matching git tag and create a GitHub Release note for the published version.");
    return;
  }

  console.log("Dry run only. To publish the verified tarball, rerun:");
  console.log(`npm run release:local -- --publish${args.tag ? ` --tag ${args.tag}` : ""}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.allowDirty) {
    ensureCleanWorktree();
  }

  ensureNpmAuth();
  run("npm", ["run", "build"]);
  run("npm", ["test"]);

  let tarball;
  try {
    tarball = packArtifact();
    if (args.publish) {
      publishArtifact(tarball, args);
    }
    printNextSteps(args, tarball);
  } finally {
    if (tarball && !args.keepTarball) {
      rmSync(tarball, { force: true });
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release failed: ${message}`);
  process.exitCode = 1;
});
