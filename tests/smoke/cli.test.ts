import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { execa } from 'execa';
import { mkdtemp, mkdir, rm, writeFile, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PATH = join(process.cwd(), 'dist/cli.js');

describe('CLI Smoke Tests - Installer Flow', () => {
  let tempRepoPath: string;
  let tempHomePath: string;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-smoke-test-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-home-test-'));
  });

  afterEach(async () => {
    if (tempRepoPath) {
      await rm(tempRepoPath, { recursive: true, force: true });
    }
    if (tempHomePath) {
      await rm(tempHomePath, { recursive: true, force: true });
    }
  });

  const runCLI = (
    args: string[],
    cwd: string = tempRepoPath,
    options: { input?: string; env?: NodeJS.ProcessEnv } = {}
  ) => {
    return execa('node', [CLI_PATH, ...args], {
      cwd,
      input: options.input,
      env: {
        ...process.env,
        HOME: tempHomePath,
        ...options.env,
      },
    });
  };

  const fileExists = async (path: string) => {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  };

  const packArtifact = async () => {
    const { stdout } = await execa('npm', ['pack', '--json'], { cwd: process.cwd() });
    const parsed = JSON.parse(stdout) as Array<{ filename: string }>;
    const filename = parsed[0]?.filename;

    if (!filename) {
      throw new Error('npm pack did not return a tarball filename');
    }

    return join(process.cwd(), filename);
  };

  describe('default installer', () => {
    it('installs the Copilot runtime globally under ~/.copilot from the default flow', async () => {
      const { exitCode, stdout } = await runCLI([], tempRepoPath);
      const globalCopilotPath = join(tempHomePath, '.copilot');

      expect(exitCode).toBe(0);
      expect(stdout).toContain(`Installing Forge Copilot runtime to ${globalCopilotPath}`);
      expect(stdout).toContain(`Global install root: ${globalCopilotPath}`);
      expect(await fileExists(join(globalCopilotPath, 'agents/forge-agent.agent.md'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'agents/forge-discussion-analyzer.agent.md'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'forge/bin/forge.mjs'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'forge/dist/cli.js'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'forge/VERSION'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'forge/forge-file-manifest.json'))).toBe(true);
      expect(await fileExists(join(tempRepoPath, '.copilot/agents/forge-agent.agent.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.claude/forge-agent.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.codex/forge-agent.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.gemini/forge-agent.md'))).toBe(false);
    });

    it('installs Copilot agents into ~/.copilot/agents for /agent discovery', async () => {
      const { exitCode } = await runCLI([], tempRepoPath);
      const globalCopilotPath = join(tempHomePath, '.copilot');

      expect(exitCode).toBe(0);
      expect(await fileExists(join(globalCopilotPath, 'agents/forge-agent.agent.md'))).toBe(true);
      expect(await fileExists(join(globalCopilotPath, 'agents/forge-discussion-analyzer.agent.md'))).toBe(true);

      const copilotAnalyzer = await readFile(
        join(globalCopilotPath, 'agents/forge-discussion-analyzer.agent.md'),
        'utf8'
      );
      if (!copilotAnalyzer) {
        throw new Error('missing copilot analyzer asset');
      }
      expect(copilotAnalyzer).toContain('---\nname: forge-discussion-analyzer');
      expect(copilotAnalyzer).toContain('description: Analyze GitHub Discussions');
      expect(copilotAnalyzer).toContain('tools:\n  - read_file');
      expect(copilotAnalyzer).toContain('color: blue');
      expect(copilotAnalyzer).toContain('Forge Discussion Analyzer');
      expect(copilotAnalyzer).toContain('node "$HOME/.copilot/forge/bin/forge.mjs" --run-summonable forge-discussion-analyzer');
    });

    it('writes installer metadata for reruns and bundled runtime state', async () => {
      await runCLI([], tempRepoPath);

      const manifestRaw = await readFile(
        join(tempHomePath, '.copilot/forge/forge-file-manifest.json'),
        'utf8'
      );
      const manifest = JSON.parse(manifestRaw) as {
        installRoot: string;
        runtimePath: string;
        runtimeEntryPath: string;
        agentsPath: string;
        summonables: string[];
        bundledFiles: string[];
      };

      expect(manifest.installRoot).toBe(join(tempHomePath, '.copilot'));
      expect(manifest.runtimePath).toBe(join(tempHomePath, '.copilot/forge'));
      expect(manifest.runtimeEntryPath).toBe(join(tempHomePath, '.copilot/forge/bin/forge.mjs'));
      expect(manifest.agentsPath).toBe(join(tempHomePath, '.copilot/agents'));
      expect(manifest.summonables).toEqual(['forge-agent', 'forge-discussion-analyzer']);
      expect(manifest.bundledFiles).toContain('forge/dist');
    });
  });

  describe('help surface', () => {
    it('presents forge as an install-first CLI without the legacy subcommands', async () => {
      const { stdout } = await runCLI(['--help']);

      expect(stdout).toContain('Usage: forge');
      expect(stdout).toContain('Install the Forge Copilot runtime into ~/.copilot');
      expect(stdout).not.toContain('--assistants <ids>');
      expect(stdout).not.toContain('--yes');
      expect(stdout).not.toContain('bootstrap');
      expect(stdout).not.toContain('analyze');
      expect(stdout).not.toContain('plan');
      expect(stdout).not.toContain('install-assistants');
      expect(stdout).not.toContain('install-copilot');
    });
  });

  describe('discussion analyzer runtime', () => {
    it('runs forge-discussion-analyzer from prepared sidecar artifacts', async () => {
      const analysisDir = join(tempRepoPath, '.forge/discussions/analysis');
      await mkdir(analysisDir, { recursive: true });
      await writeFile(
        join(analysisDir, 'latest.json'),
        JSON.stringify({
          version: '1.0',
          id: 'prepared-run',
          sourceRunId: 'fetch-run',
          timestamp: '2026-03-03T10:00:00.000Z',
          repository: {
            owner: 'ajitgunturi',
            name: 'forge',
            remoteUrl: 'https://github.com/ajitgunturi/forge.git',
          },
          filters: {
            limit: 25,
          },
          totals: {
            discussions: 1,
            statuses: { unresolved: 1 },
            kinds: { consultation: 1 },
          },
          records: [
            {
              number: 101,
              title: 'Patterns in support',
              url: 'https://github.com/ajitgunturi/forge/discussions/101',
              category: 'Ideas',
              status: 'unresolved',
              kind: 'consultation',
              issue: 'Users repeatedly ask about authentication setup and filtering.',
              resolution: 'No clear resolution is recorded yet.',
              keyContext: ['authentication setup', 'discussion filtering'],
              actionItems: ['Confirm current owner'],
              updatedAt: '2026-03-03T09:00:00.000Z',
            },
          ],
        }, null, 2),
        'utf8'
      );

      const { exitCode, stdout } = await runCLI([
        '--run-summonable',
        'forge-discussion-analyzer',
        '--question',
        'What recurring patterns are visible in support discussions?',
      ]);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('GitHub Discussions Digest');
      expect(stdout).toContain('Pattern Analysis');
      expect(stdout).toContain('Patterns in support');
    });
  });

  describe('packaging metadata', () => {
    it('publishes the forge binary while keeping the package name', async () => {
      const manifestRaw = await readFile(join(process.cwd(), 'package.json'), 'utf8');
      const manifest = JSON.parse(manifestRaw) as {
        name: string;
        bin: Record<string, string>;
        repository?: { url?: string };
        publishConfig?: { access?: string };
      };

      expect(manifest.name).toBe('forge-ai-assist');
      expect(manifest.bin).toEqual({ forge: './dist/cli.js' });
      expect(manifest.repository?.url).toContain('github.com/ajitgunturi/forge.git');
      expect(manifest.publishConfig?.access).toBe('public');
    });

    it('installs and runs from the packed tarball', async () => {
      const tarballPath = await packArtifact();
      const installPath = await mkdtemp(join(tmpdir(), 'forge-packed-install-'));

      try {
        await execa('npm', ['init', '-y'], { cwd: installPath });
        await execa('npm', ['install', tarballPath], { cwd: installPath });

        const forgeBin = join(installPath, 'node_modules', '.bin', 'forge');
        const { stdout, exitCode } = await execa(forgeBin, ['--help'], { cwd: installPath, timeout: 15000 });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Usage: forge');
        expect(stdout).toContain('Install the Forge Copilot runtime into ~/.copilot');
      } finally {
        await rm(installPath, { recursive: true, force: true });
        await rm(tarballPath, { force: true });
      }
    }, 20000);
  });
});
