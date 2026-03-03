import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { execa } from 'execa';
import { mkdtemp, mkdir, rm, writeFile, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PATH = join(process.cwd(), 'dist/cli.js');

describe('CLI Smoke Tests - Installer Flow', () => {
  let tempRepoPath: string;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-smoke-test-'));
  });

  afterEach(async () => {
    if (tempRepoPath) {
      await rm(tempRepoPath, { recursive: true, force: true });
    }
  });

  const runCLI = (
    args: string[],
    cwd: string = tempRepoPath,
    options: { input?: string } = {}
  ) => {
    return execa('node', [CLI_PATH, ...args], { cwd, input: options.input });
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
    it('installs Copilot summonables from the default flow', async () => {
      const { exitCode, stdout } = await runCLI([], tempRepoPath);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Installing Forge Copilot summonables');
      expect(await fileExists(join(tempRepoPath, '.copilot/agents/forge-agent.agent.md'))).toBe(true);
      expect(await fileExists(join(tempRepoPath, '.copilot/agents/forge-discussion-analyzer.agent.md'))).toBe(true);
      expect(await fileExists(join(tempRepoPath, '.claude/forge-agent.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.codex/forge-agent.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.gemini/forge-agent.md'))).toBe(false);
    });

    it('installs Copilot agents into .copilot/agents for /agent discovery', async () => {
      const { exitCode } = await runCLI([], tempRepoPath);

      expect(exitCode).toBe(0);
      expect(await fileExists(join(tempRepoPath, '.copilot/agents/forge-agent.agent.md'))).toBe(true);
      expect(await fileExists(join(tempRepoPath, '.copilot/agents/forge-discussion-analyzer.agent.md'))).toBe(true);

      const copilotAnalyzer = await readFile(
        join(tempRepoPath, '.copilot/agents/forge-discussion-analyzer.agent.md'),
        'utf8'
      );
      if (!copilotAnalyzer) {
        throw new Error('missing copilot analyzer asset');
      }
      expect(copilotAnalyzer).toContain('Forge Discussion Analyzer');
      expect(copilotAnalyzer).toContain('forge-discussion-analyzer');
    });
  });

  describe('help surface', () => {
    it('presents forge as an install-first CLI without the legacy subcommands', async () => {
      const { stdout } = await runCLI(['--help']);

      expect(stdout).toContain('Usage: forge');
      expect(stdout).toContain('Install Forge Copilot summonables');
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
        const { stdout, exitCode } = await execa(forgeBin, ['--help'], { cwd: installPath });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Usage: forge');
        expect(stdout).toContain('Install Forge Copilot summonables');
      } finally {
        await rm(installPath, { recursive: true, force: true });
        await rm(tarballPath, { force: true });
      }
    });
  });
});
