import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { execa } from 'execa';
import { mkdtemp, rm, writeFile, mkdir, stat, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

const CLI_PATH = join(process.cwd(), 'dist/cli.js');

describe('CLI Smoke Tests - Full Flow', () => {
  let tempRepoPath: string;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-smoke-test-'));
  });

  afterEach(async () => {
    if (tempRepoPath) {
      await rm(tempRepoPath, { recursive: true, force: true });
    }
  });

  const runCLI = (args: string[], cwd: string = tempRepoPath) => {
    return execa('node', [CLI_PATH, ...args], { cwd });
  };

  const initGitRepo = async (path: string) => {
    await execa('git', ['init'], { cwd: path });
    await execa('git', ['config', 'user.email', 'test@example.com'], { cwd: path });
    await execa('git', ['config', 'user.name', 'Test User'], { cwd: path });
    await writeFile(join(path, 'package.json'), '{}');
    await execa('git', ['add', '.'], { cwd: path });
    await execa('git', ['commit', '-m', 'Initial commit'], { cwd: path });
  };

  const fileExists = async (path: string) => {
    try {
      await stat(path);
      return true;
    } catch {
      return false;
    }
  };

  describe('bootstrap', () => {
    it('creates .forge/metadata.json in a git repo', async () => {
      await initGitRepo(tempRepoPath);
      const { exitCode } = await runCLI(['bootstrap']);
      expect(exitCode).toBe(0);
      expect(await fileExists(join(tempRepoPath, '.forge/metadata.json'))).toBe(true);
    });

    it('exits with error outside a git repo', async () => {
      try {
        await runCLI(['bootstrap']);
        expect.fail('Should have failed');
      } catch (error: any) {
        expect(error.exitCode).not.toBe(0);
        expect(error.stderr).toContain('Not in a Git repository');
      }
    });
  });

  describe('analyze', () => {
    it('generates analysis artifacts in .forge/analysis/', async () => {
      await initGitRepo(tempRepoPath);
      await runCLI(['bootstrap']);
      
      const { exitCode } = await runCLI(['analyze']);
      expect(exitCode).toBe(0);
      
      expect(await fileExists(join(tempRepoPath, '.forge/analysis/latest.json'))).toBe(true);
    });
  });

  describe('plan', () => {
    it('generates a plan in .forge/planning/ based on analysis', async () => {
      await initGitRepo(tempRepoPath);
      await runCLI(['bootstrap']);
      await runCLI(['analyze']);
      
      const { exitCode, stdout } = await runCLI(['plan', '--task', 'Implement a new feature']);
      expect(exitCode).toBe(0);
      
      const plansDir = join(tempRepoPath, '.forge/planning/plans');
      expect(await fileExists(plansDir)).toBe(true);
      expect(await fileExists(join(tempRepoPath, '.forge/planning/latest.json'))).toBe(true);
      
      expect(stdout).toContain('Planning complete');
    });
  });

  describe('idempotency', () => {
    it('multiple runs do not corrupt metadata or sidecar', async () => {
      await initGitRepo(tempRepoPath);
      
      // Run bootstrap twice
      await runCLI(['bootstrap']);
      const metadataFirstRaw = await readFile(join(tempRepoPath, '.forge/metadata.json'), 'utf-8');
      const metadataFirst = JSON.parse(metadataFirstRaw);
      
      await runCLI(['bootstrap']);
      const metadataSecondRaw = await readFile(join(tempRepoPath, '.forge/metadata.json'), 'utf-8');
      const metadataSecond = JSON.parse(metadataSecondRaw);
      
      expect(metadataFirst.createdAt).toBe(metadataSecond.createdAt);
      expect(metadataSecond.history.length).toBeGreaterThan(metadataFirst.history.length);

      // Run analyze twice
      await runCLI(['analyze']);
      await runCLI(['analyze']);
      
      expect(await fileExists(join(tempRepoPath, '.forge/analysis/latest.json'))).toBe(true);
    });
  });
});
