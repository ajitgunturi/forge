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
      await safeRm(tempRepoPath);
    }
    if (tempHomePath) {
      await safeRm(tempHomePath);
    }
  });

  const runCLI = (
    args: string[],
    cwd: string = tempRepoPath,
    options: { input?: string; env?: NodeJS.ProcessEnv } = {},
  ) => {
    return execa('node', [CLI_PATH, ...args], {
      cwd,
      input: options.input,
      env: {
        ...process.env,
        HOME: tempHomePath,
        FORGE_SKIP_SELF_REFRESH: '1',
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
    const npmCachePath = await mkdtemp(join(tmpdir(), 'forge-npm-cache-'));
    const { stdout } = await execa('npm', ['pack', '--json'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        npm_config_cache: npmCachePath,
      },
    });
    const parsed = JSON.parse(stdout) as Array<{ filename: string }>;
    const filename = parsed[0]?.filename;

    if (!filename) {
      throw new Error('npm pack did not return a tarball filename');
    }

    return join(process.cwd(), filename);
  };

  const resetTempPaths = async () => {
    await safeRm(tempRepoPath);
    await safeRm(tempHomePath);
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-smoke-test-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-home-test-'));
  };

  describe('default installer', () => {
    it('installs all runtime assets in the expected global locations', async () => {
      const { exitCode, stdout } = await runCLI([]);
      const copilotRoot = join(tempHomePath, '.copilot');
      const claudeRoot = join(tempHomePath, '.claude');
      const codexRoot = join(tempHomePath, '.codex');
      const geminiRoot = join(tempHomePath, '.gemini');

      expect(exitCode).toBe(0);
      expect(stdout).toContain(`Installing Forge Copilot runtime to ${copilotRoot}`);
      expect(stdout).toContain(`Installing Forge Claude assets to ${claudeRoot}`);
      expect(stdout).toContain(`Installing Forge Codex assets to ${codexRoot}`);
      expect(stdout).toContain(`Installing Forge Gemini assets to ${geminiRoot}`);
      expect(stdout).toContain('✅ copilot');
      expect(stdout).toContain('✅ claude');
      expect(stdout).toContain('✅ codex');
      expect(stdout).toContain('✅ gemini');

      expect(await fileExists(join(copilotRoot, 'agents/forge-discussion-analyzer.agent.md'))).toBe(true);
      expect(await fileExists(join(copilotRoot, 'skills/forge-discussion-analyzer/SKILL.md'))).toBe(true);

      expect(await fileExists(join(claudeRoot, 'commands/forge/discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(claudeRoot, 'agents/forge-discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(claudeRoot, 'forge/workflows/discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(claudeRoot, 'skills/forge:discussion-analyzer/SKILL.md'))).toBe(false);

      expect(await fileExists(join(codexRoot, 'skills/forge-discussion-analyzer/SKILL.md'))).toBe(true);
      expect(await fileExists(join(codexRoot, 'agents/forge-discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(codexRoot, 'agents/forge-discussion-analyzer.toml'))).toBe(true);
      expect(await fileExists(join(codexRoot, 'forge/workflows/discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(codexRoot, 'forge:discussion-analyzer.md'))).toBe(false);

      expect(await fileExists(join(geminiRoot, 'commands/forge/discussion-analyzer.toml'))).toBe(true);
      expect(await fileExists(join(geminiRoot, 'agents/forge-discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(geminiRoot, 'forge/workflows/discussion-analyzer.md'))).toBe(true);
      expect(await fileExists(join(geminiRoot, 'forge:discussion-analyzer.md'))).toBe(false);

      expect(await fileExists(join(copilotRoot, 'forge/bin/forge.mjs'))).toBe(true);
      expect(await fileExists(join(claudeRoot, 'forge/bin/forge.mjs'))).toBe(true);
      expect(await fileExists(join(codexRoot, 'forge/bin/forge.mjs'))).toBe(true);
      expect(await fileExists(join(geminiRoot, 'forge/bin/forge.mjs'))).toBe(true);

      expect(await fileExists(join(tempRepoPath, '.codex/forge:discussion-analyzer.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.gemini/forge:discussion-analyzer.md'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.codex'))).toBe(false);
      expect(await fileExists(join(tempRepoPath, '.gemini'))).toBe(false);
      expect(await fileExists(join(tempHomePath, '.config/gh'))).toBe(false);
    }, 20000);

    it('installs content that points each runtime at its own bundled backend', async () => {
      await runCLI([]);

      const copilotAgent = await readFile(join(tempHomePath, '.copilot/agents/forge-discussion-analyzer.agent.md'), 'utf8');
      const claudeCommand = await readFile(join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md'), 'utf8');
      const claudeAgent = await readFile(join(tempHomePath, '.claude/agents/forge-discussion-analyzer.md'), 'utf8');
      const codexSkill = await readFile(join(tempHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md'), 'utf8');
      const codexAgentToml = await readFile(join(tempHomePath, '.codex/agents/forge-discussion-analyzer.toml'), 'utf8');
      const geminiCommand = await readFile(join(tempHomePath, '.gemini/commands/forge/discussion-analyzer.toml'), 'utf8');

      expect(copilotAgent).toContain('node "$HOME/.copilot/forge/bin/forge.mjs" --run forge-discussion-analyzer --question');
      expect(claudeCommand).toContain('---\nname: forge:discussion-analyzer');
      expect(claudeCommand).toContain(`@${join(tempHomePath, '.claude/forge/workflows/discussion-analyzer.md')}`);
      expect(claudeAgent).toContain('node "$HOME/.claude/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "<question>"');
      expect(codexSkill).toContain('`$forge-discussion-analyzer`');
      expect(codexSkill).toContain(`@${join(tempHomePath, '.codex/forge/workflows/discussion-analyzer.md')}`);
      expect(codexAgentToml).toContain('node "$HOME/.codex/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "<question>"');
      expect(geminiCommand).toContain('Forge backend: node \\"$HOME/.gemini/forge/bin/forge.mjs\\" --run forge-discussion-analyzer --question \\"<question>\\"');
      expect(geminiCommand).toContain('Do not inspect the codebase, search the repository, or read files under ~/.gemini before deciding what to do.');
    });

    it('preserves user customizations for managed markdown assets on reinstall', async () => {
      await runCLI([]);
      const copilotSkillPath = join(tempHomePath, '.copilot/skills/forge-discussion-analyzer/SKILL.md');
      const claudeCommandPath = join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md');
      const codexSkillPath = join(tempHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md');
      const geminiAgentPath = join(tempHomePath, '.gemini/agents/forge-discussion-analyzer.md');

      await writeFile(
        copilotSkillPath,
        (await readFile(copilotSkillPath, 'utf8')).replace(
          '<!-- Add team- or user-specific Copilot skill instructions below this line. -->',
          'Team custom Copilot skill instruction',
        ),
        'utf8',
      );
      await writeFile(
        claudeCommandPath,
        (await readFile(claudeCommandPath, 'utf8')).replace(
          '<!-- Add team- or user-specific Claude command instructions below this line. -->',
          'Team custom Claude command instruction',
        ),
        'utf8',
      );
      await writeFile(
        codexSkillPath,
        (await readFile(codexSkillPath, 'utf8')).replace(
          '<!-- Add team- or user-specific Codex skill instructions below this line. -->',
          'Team custom Codex skill instruction',
        ),
        'utf8',
      );
      await writeFile(
        geminiAgentPath,
        (await readFile(geminiAgentPath, 'utf8')).replace(
          '<!-- Add team- or user-specific Gemini agent instructions below this line. -->',
          'Team custom Gemini agent instruction',
        ),
        'utf8',
      );

      await runCLI([]);

      expect(await readFile(copilotSkillPath, 'utf8')).toContain('Team custom Copilot skill instruction');
      expect(await readFile(claudeCommandPath, 'utf8')).toContain('Team custom Claude command instruction');
      expect(await readFile(codexSkillPath, 'utf8')).toContain('Team custom Codex skill instruction');
      expect(await readFile(geminiAgentPath, 'utf8')).toContain('Team custom Gemini agent instruction');
    }, 20000);

    it('writes installer metadata for every runtime bundle', async () => {
      await runCLI([]);

      const claudeManifest = JSON.parse(
        await readFile(join(tempHomePath, '.claude/forge/forge-file-manifest.json'), 'utf8'),
      ) as {
        installRoot: string;
        runtimePath: string;
        runtimeEntryPath: string;
        agentsPath: string;
        commandsPath?: string;
        workflowsPath?: string;
        bundledFiles: string[];
      };
      const codexManifest = JSON.parse(
        await readFile(join(tempHomePath, '.codex/forge/forge-file-manifest.json'), 'utf8'),
      ) as {
        skillsPath?: string;
        workflowsPath?: string;
      };
      const geminiManifest = JSON.parse(
        await readFile(join(tempHomePath, '.gemini/forge/forge-file-manifest.json'), 'utf8'),
      ) as {
        commandsPath?: string;
        workflowsPath?: string;
      };

      expect(claudeManifest.installRoot).toBe(join(tempHomePath, '.claude'));
      expect(claudeManifest.runtimePath).toBe(join(tempHomePath, '.claude/forge'));
      expect(claudeManifest.runtimeEntryPath).toBe(join(tempHomePath, '.claude/forge/bin/forge.mjs'));
      expect(claudeManifest.agentsPath).toBe(join(tempHomePath, '.claude/agents'));
      expect(claudeManifest.commandsPath).toBe(join(tempHomePath, '.claude/commands'));
      expect(claudeManifest.workflowsPath).toBe(join(tempHomePath, '.claude/forge/workflows'));
      expect(claudeManifest.bundledFiles).toContain('forge/dist');
      expect(codexManifest.skillsPath).toBe(join(tempHomePath, '.codex/skills'));
      expect(codexManifest.workflowsPath).toBe(join(tempHomePath, '.codex/forge/workflows'));
      expect(geminiManifest.commandsPath).toBe(join(tempHomePath, '.gemini/commands'));
      expect(geminiManifest.workflowsPath).toBe(join(tempHomePath, '.gemini/forge/workflows'));
    });

    it('removes the legacy forge-agent file on reinstall', async () => {
      const legacyAgentPath = join(tempHomePath, '.copilot/agents/forge-agent.agent.md');
      await mkdir(join(tempHomePath, '.copilot/agents'), { recursive: true });
      await writeFile(legacyAgentPath, 'legacy agent', 'utf8');

      await runCLI([]);

      expect(await fileExists(legacyAgentPath)).toBe(false);
    });

    it('runs the installed bundled runtime without extra npm installs', async () => {
      await runCLI([]);

      const bundledRuntimePath = join(tempHomePath, '.codex/forge/bin/forge.mjs');
      const { stdout, exitCode } = await execa('node', [bundledRuntimePath, '--help'], {
        cwd: tempRepoPath,
        env: {
          ...process.env,
          HOME: tempHomePath,
          FORGE_SKIP_SELF_REFRESH: '1',
        },
      });

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Usage: forge');
      expect(stdout).toContain('Install Forge assistant assets for Copilot, Claude, Codex, and Gemini');
    });

    it('shows installer detail lines only in verbose mode', async () => {
      const defaultRun = await runCLI([]);
      await safeRm(tempHomePath);
      tempHomePath = await mkdtemp(join(tmpdir(), 'forge-home-test-'));
      const verboseRun = await runCLI(['--verbose']);

      expect(defaultRun.stdout).not.toContain('installed bundled runtime to');
      expect(defaultRun.stdout).not.toContain('updated manifest');
      expect(verboseRun.stdout).toContain('installed bundled runtime to');
      expect(verboseRun.stdout).toContain('bundled tool entry:');
    }, 20000);
  });

  describe('explicit install selection', () => {
    it('installs only the requested runtime assets', async () => {
      const cases = [
        {
          assistant: 'copilot',
          expected: (homePath: string) => join(homePath, '.copilot/agents/forge-discussion-analyzer.agent.md'),
          unexpected: (homePath: string) => join(homePath, '.claude/commands/forge/discussion-analyzer.md'),
        },
        {
          assistant: 'claude',
          expected: (homePath: string) => join(homePath, '.claude/commands/forge/discussion-analyzer.md'),
          unexpected: (homePath: string) => join(homePath, '.codex/skills/forge-discussion-analyzer/SKILL.md'),
        },
        {
          assistant: 'codex',
          expected: (homePath: string) => join(homePath, '.codex/skills/forge-discussion-analyzer/SKILL.md'),
          unexpected: (homePath: string) => join(homePath, '.gemini/commands/forge/discussion-analyzer.toml'),
        },
        {
          assistant: 'gemini',
          expected: (homePath: string) => join(homePath, '.gemini/commands/forge/discussion-analyzer.toml'),
          unexpected: (homePath: string) => join(homePath, '.copilot/agents/forge-discussion-analyzer.agent.md'),
        },
      ] as const;

      for (const testCase of cases) {
        await resetTempPaths();

        const { exitCode, stdout } = await runCLI(['--assistants', testCase.assistant]);

        expect(exitCode).toBe(0);
        expect(stdout).toContain(`✅ ${testCase.assistant}`);
        expect(await fileExists(testCase.expected(tempHomePath))).toBe(true);
        expect(await fileExists(testCase.unexpected(tempHomePath))).toBe(false);
      }
    }, 20000);
  });

  describe('help surface', () => {
    it('presents forge as an install-first CLI without the legacy subcommands', async () => {
      const { stdout } = await runCLI(['--help']);

      expect(stdout).toContain('Usage: forge');
      expect(stdout).toContain('Install Forge assistant assets for Copilot, Claude, Codex, and Gemini');
      expect(stdout).toContain('--run <analyzer>');
      expect(stdout).toContain('--assistants <targets>');
      expect(stdout).not.toContain('--yes');
      expect(stdout).not.toContain('bootstrap');
      expect(stdout).not.toContain('forge analyze');
      expect(stdout).not.toContain('plan');
      expect(stdout).not.toContain('install-assistants');
      expect(stdout).not.toContain('install-copilot');
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
      const packedHomePath = await mkdtemp(join(tmpdir(), 'forge-packed-home-'));

      try {
        await execa('npm', ['init', '-y'], { cwd: installPath });
        const npmCachePath = await mkdtemp(join(tmpdir(), 'forge-packed-cache-'));
        await execa('npm', ['install', tarballPath], {
          cwd: installPath,
          env: {
            ...process.env,
            npm_config_cache: npmCachePath,
          },
        });

        const forgeBin = join(installPath, 'node_modules', '.bin', 'forge');
        const { stdout, exitCode } = await execa(forgeBin, ['--help'], {
          cwd: installPath,
          timeout: 15000,
          env: {
            ...process.env,
            FORGE_SKIP_SELF_REFRESH: '1',
          },
        });

        expect(exitCode).toBe(0);
        expect(stdout).toContain('Usage: forge');
        expect(stdout).toContain('Install Forge assistant assets for Copilot, Claude, Codex, and Gemini');

        const installRun = await execa(forgeBin, [], {
          cwd: installPath,
          timeout: 20000,
          env: {
            ...process.env,
            HOME: packedHomePath,
            FORGE_SKIP_SELF_REFRESH: '1',
          },
        });

        expect(installRun.exitCode).toBe(0);
        expect(await fileExists(join(packedHomePath, '.copilot/agents/forge-discussion-analyzer.agent.md'))).toBe(true);
        expect(await fileExists(join(packedHomePath, '.claude/commands/forge/discussion-analyzer.md'))).toBe(true);
        expect(await fileExists(join(packedHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md'))).toBe(true);
        expect(await fileExists(join(packedHomePath, '.gemini/commands/forge/discussion-analyzer.toml'))).toBe(true);
        expect(await fileExists(join(installPath, '.codex'))).toBe(false);
        expect(await fileExists(join(installPath, '.gemini'))).toBe(false);
      } finally {
        await safeRm(installPath);
        await safeRm(packedHomePath);
        await safeRm(tarballPath);
      }
    }, 20000);
  });
});

async function safeRm(targetPath: string): Promise<void> {
  await rm(targetPath, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
