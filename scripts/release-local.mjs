#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function parseArgs(argv) {
  const args = {
    publish: false,
    tag: undefined,
    otp: undefined,
    allowDirty: false,
    keepTarball: false,
    version: undefined,
    skipVersionBump: false,
    login: "auto",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];

    if (!value.startsWith("-")) {
      if (args.version) {
        throw new Error(`Unexpected extra argument: ${value}`);
      }
      args.version = normalizeVersion(value);
      continue;
    }

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

    if (value === "--skip-version-bump") {
      args.skipVersionBump = true;
      continue;
    }

    if (value === "--version") {
      args.version = normalizeVersion(argv[index + 1]);
      index += 1;
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

    if (value === "--login") {
      args.login = argv[index + 1] ?? "auto";
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

function normalizeVersion(value) {
  if (!value) {
    throw new Error("Missing version value.");
  }

  const normalized = value.startsWith("v") ? value.slice(1) : value;
  if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(normalized)) {
    throw new Error(`Invalid version: ${value}`);
  }

  return normalized;
}

function printHelp() {
  console.log(`Usage: npm run release:local -- [options]

Options:
  <version>       Set package.json to this semver before releasing (accepts v1.2.3)
  --publish       Publish the packed tarball to npm after validation
  --tag <name>    Publish under a dist-tag such as latest or next
  --otp <code>    Pass a one-time password to npm publish
  --version <v>   Explicit version override, same as the positional version
  --skip-version-bump
                  Do not change package.json before releasing
  --login <mode>  npm auth mode: auto, always, or never
  --allow-dirty   Skip the clean git worktree check
  --keep-tarball  Keep the generated .tgz artifact after the script exits
  -h, --help      Show this help message
`);
}

function run(command, args, options = {}) {
  const display = [command, ...args].join(" ");
  console.log(`\n$ ${display}`);
  return execFileSync(command, args, {
    env: options.env ?? process.env,
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

function hasNpmToken() {
  return typeof process.env.NPM_TOKEN === "string" && process.env.NPM_TOKEN.trim().length > 0;
}

function createTokenAuthEnv() {
  const directory = mkdtempSync(join(tmpdir(), "forge-npmrc-"));
  const userConfigPath = join(directory, ".npmrc");
  const registry = process.env.NPM_REGISTRY_URL?.trim() || "https://registry.npmjs.org/";
  const registryHost = registry.replace(/^https?:/, "");
  const token = process.env.NPM_TOKEN?.trim();

  if (!token) {
    throw new Error("Missing NPM_TOKEN.");
  }

  writeFileSync(
    userConfigPath,
    `registry=${registry}\n${registryHost}:_authToken=${token}\nalways-auth=true\n`,
    "utf8",
  );

  return {
    env: {
      ...process.env,
      NPM_CONFIG_USERCONFIG: userConfigPath,
    },
    cleanup() {
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function ensureNpmAuthWithLogin(args) {
  if (hasNpmToken()) {
    console.log("Using npm authentication from NPM_TOKEN.");
    return null;
  }

  try {
    if (args.login === "always") {
      run("npm", ["login"]);
    }

    ensureNpmAuth();
    return null;
  } catch (error) {
    if (args.login === "never") {
      throw error;
    }

    console.log("npm auth missing. Starting `npm login`.");
    run("npm", ["login"]);
    ensureNpmAuth();
    return null;
  }
}

function setReleaseVersion(version) {
  run("npm", ["version", version, "--no-git-tag-version"]);
  console.log(`Release version set to ${version}`);
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

function publishArtifact(filename, args, env) {
  const publishArgs = ["publish", filename, "--access", "public"];

  if (args.tag) {
    publishArgs.push("--tag", args.tag);
  }

  if (args.otp) {
    publishArgs.push("--otp", args.otp);
  }

  run("npm", publishArgs, { env });
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
  console.log(`npm run release:local --${args.version ? ` ${args.version}` : ""} --publish${args.tag ? ` --tag ${args.tag}` : ""}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.allowDirty) {
    ensureCleanWorktree();
  }

  if (!args.skipVersionBump && args.version) {
    setReleaseVersion(args.version);
  }

  const tokenAuth = hasNpmToken() ? createTokenAuthEnv() : null;

  try {
    ensureNpmAuthWithLogin(args);
    run("npm", ["run", "build"]);
    run("npm", ["test"]);

    let tarball;
    try {
      tarball = packArtifact();
      if (args.publish) {
        publishArtifact(tarball, args, tokenAuth?.env);
      }
      printNextSteps(args, tarball);
    } finally {
      if (tarball && !args.keepTarball) {
        rmSync(tarball, { force: true });
      }
    }
  } finally {
    tokenAuth?.cleanup();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Release failed: ${message}`);
  process.exitCode = 1;
});
