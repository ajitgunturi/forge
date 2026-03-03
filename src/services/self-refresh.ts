import { execa } from 'execa';

const PACKAGE_NAME = 'forge-ai-assist';
const REGISTRY_LATEST_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const SELF_REFRESH_GUARD = 'FORGE_SELF_REFRESHED';
const SELF_REFRESH_DISABLE = 'FORGE_SKIP_SELF_REFRESH';

export async function refreshIfOutdated(
  currentVersion: string,
  argv: string[],
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (!shouldCheckForLatest(argv, env)) {
    return false;
  }

  const latestVersion = await fetchLatestVersion();
  if (!latestVersion || compareVersions(currentVersion, latestVersion) >= 0) {
    return false;
  }

  console.log(`Refreshing Forge from ${currentVersion} to ${latestVersion} before continuing...`);

  const child = await execa(
    'npm',
    ['exec', '--yes', '--package', `${PACKAGE_NAME}@latest`, '--', 'forge', ...argv.slice(2)],
    {
      stdio: 'inherit',
      env: {
        ...env,
        [SELF_REFRESH_GUARD]: '1',
        npm_config_prefer_online: 'true',
        npm_config_cache_min: '0',
        npm_config_cache_max: '0',
      },
    },
  );

  process.exit(child.exitCode ?? 0);
}

export function shouldCheckForLatest(argv: string[], env: NodeJS.ProcessEnv): boolean {
  if (env[SELF_REFRESH_DISABLE] === '1' || env[SELF_REFRESH_GUARD] === '1') {
    return false;
  }

  const entryPath = argv[1] ?? '';
  return entryPath.includes('/_npx/') || entryPath.includes('\\_npx\\');
}

export function compareVersions(left: string, right: string): number {
  const leftParts = normalizeVersion(left);
  const rightParts = normalizeVersion(right);
  const maxLength = Math.max(leftParts.length, rightParts.length);

  for (let index = 0; index < maxLength; index += 1) {
    const delta = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (delta !== 0) {
      return delta > 0 ? 1 : -1;
    }
  }

  return 0;
}

async function fetchLatestVersion(): Promise<string | null> {
  try {
    const response = await fetch(REGISTRY_LATEST_URL, {
      headers: {
        accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { version?: string };
    return payload.version ?? null;
  } catch {
    return null;
  }
}

function normalizeVersion(value: string): number[] {
  return value
    .replace(/^v/i, '')
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .filter((part) => Number.isFinite(part));
}
