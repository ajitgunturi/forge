import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPluginStatusList,
  formatStatusOutput,
  gatherForgeStatus,
  ForgeStatus,
  AssistantStatusInfo,
  PluginStatusInfo,
} from '../../../src/commands/status.js';
import { getPluginGroupInfo } from '../../../src/services/assistants/summonables.js';

describe('forge status command', () => {
  describe('buildPluginStatusList', () => {
    it('marks plugins as installed when their ID is in the set', () => {
      const groupInfos = getPluginGroupInfo();
      const installedIds = new Set(['forge-discussion-analyzer', 'forge-issue-analyzer']);
      const result = buildPluginStatusList(groupInfos, installedIds);

      const discussion = result.find((p) => p.id === 'forge-discussion-analyzer');
      expect(discussion).toBeDefined();
      expect(discussion!.isInstalled).toBe(true);
      expect(discussion!.groupId).toBe('core');
      expect(discussion!.groupLabel).toBe('Core');

      const issue = result.find((p) => p.id === 'forge-issue-analyzer');
      expect(issue).toBeDefined();
      expect(issue!.isInstalled).toBe(true);
    });

    it('marks plugins as not installed when missing from the set', () => {
      const groupInfos = getPluginGroupInfo();
      const installedIds = new Set<string>();
      const result = buildPluginStatusList(groupInfos, installedIds);

      for (const plugin of result) {
        expect(plugin.isInstalled).toBe(false);
      }
    });

    it('includes plugins from all groups', () => {
      const groupInfos = getPluginGroupInfo();
      const installedIds = new Set<string>();
      const result = buildPluginStatusList(groupInfos, installedIds);

      const groupIds = new Set(result.map((p) => p.groupId));
      expect(groupIds).toContain('core');
      expect(groupIds).toContain('elevate');
      expect(groupIds).toContain('ops');
    });

    it('includes the release notes generator in ops group', () => {
      const groupInfos = getPluginGroupInfo();
      const installedIds = new Set(['forge-release-notes-generator']);
      const result = buildPluginStatusList(groupInfos, installedIds);

      const releaseNotes = result.find((p) => p.id === 'forge-release-notes-generator');
      expect(releaseNotes).toBeDefined();
      expect(releaseNotes!.isInstalled).toBe(true);
      expect(releaseNotes!.groupId).toBe('ops');
      expect(releaseNotes!.groupLabel).toBe('Ops');
    });
  });

  describe('formatStatusOutput', () => {
    it('renders version header', () => {
      const status = createMinimalStatus('1.2.3');
      const output = formatStatusOutput(status);
      expect(output).toContain('Forge v1.2.3');
    });

    it('renders assistant availability with plugin counts', () => {
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [
          {
            id: 'claude',
            name: 'Claude',
            isAvailable: true,
            rootPath: '/home/user/.claude',
            installedPluginIds: ['forge-discussion-analyzer', 'forge-issue-analyzer'],
          },
          {
            id: 'gemini',
            name: 'Gemini',
            isAvailable: false,
            rootPath: '/home/user/.gemini',
            installedPluginIds: [],
          },
        ],
        plugins: [],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('Assistants:');
      expect(output).toContain('✓ Claude');
      expect(output).toContain('2 plugins');
      expect(output).toContain('○ Gemini');
      expect(output).toContain('not detected');
    });

    it('renders assistant with no plugins as available but empty', () => {
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [
          {
            id: 'copilot',
            name: 'Copilot',
            isAvailable: true,
            rootPath: '/home/user/.copilot',
            installedPluginIds: [],
          },
        ],
        plugins: [],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('○ Copilot');
      expect(output).toContain('no plugins installed');
    });

    it('renders singular plugin count correctly', () => {
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [
          {
            id: 'claude',
            name: 'Claude',
            isAvailable: true,
            rootPath: '/home/user/.claude',
            installedPluginIds: ['forge-issue-analyzer'],
          },
        ],
        plugins: [],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('1 plugin)');
      expect(output).not.toContain('1 plugins');
    });

    it('renders installed plugins grouped by plugin group', () => {
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [],
        plugins: [
          { id: 'forge-discussion-analyzer', displayName: 'Forge Discussion Analyzer', groupId: 'core', groupLabel: 'Core', isInstalled: true },
          { id: 'forge-issue-analyzer', displayName: 'Forge Issue Analyzer', groupId: 'core', groupLabel: 'Core', isInstalled: true },
          { id: 'forge-commit-craft-coach', displayName: 'Forge Commit Craft Coach', groupId: 'elevate', groupLabel: 'Elevate', isInstalled: false },
        ],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('Installed Plugins:');
      expect(output).toContain('Core:');
      expect(output).toContain('✓ forge-discussion-analyzer');
      expect(output).toContain('✓ forge-issue-analyzer');
      expect(output).toContain('Elevate:');
      expect(output).toContain('○ forge-commit-craft-coach');
      expect(output).toContain('install with --plugins elevate');
    });

    it('renders ops group plugins with install hint', () => {
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [],
        plugins: [
          { id: 'forge-release-notes-generator', displayName: 'Forge Release Notes Generator', groupId: 'ops', groupLabel: 'Ops', isInstalled: false },
        ],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('Ops:');
      expect(output).toContain('○ forge-release-notes-generator');
      expect(output).toContain('install with --plugins ops');
    });

    it('uses tilde notation for home directory paths', () => {
      const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
      const status: ForgeStatus = {
        version: '1.0.0',
        assistants: [
          {
            id: 'claude',
            name: 'Claude',
            isAvailable: true,
            rootPath: `${home}/.claude`,
            installedPluginIds: ['forge-issue-analyzer'],
          },
        ],
        plugins: [],
      };

      const output = formatStatusOutput(status);
      expect(output).toContain('~/.claude');
    });
  });
});

function createMinimalStatus(version: string): ForgeStatus {
  return {
    version,
    assistants: [],
    plugins: [],
  };
}

describe('gatherForgeStatus (integration)', () => {
  let tempRepoPath: string;
  let tempHomePath: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-status-repo-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-status-home-'));
    process.env.HOME = tempHomePath;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempRepoPath, { recursive: true, force: true });
    await rm(tempHomePath, { recursive: true, force: true });
  });

  it('detects no plugins installed on a clean home directory', async () => {
    const status = await gatherForgeStatus(tempRepoPath, '1.0.0');

    expect(status.version).toBe('1.0.0');
    expect(status.assistants.length).toBeGreaterThan(0);

    for (const assistant of status.assistants) {
      expect(assistant.installedPluginIds).toEqual([]);
    }
  });

  it('detects installed plugins from managed block markers', async () => {
    const claudeCommandsDir = join(tempHomePath, '.claude/commands/forge');
    await mkdir(claudeCommandsDir, { recursive: true });

    await writeFile(
      join(claudeCommandsDir, 'discussion-analyzer.md'),
      [
        '---',
        'name: forge:discussion-analyzer',
        '---',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
      ].join('\n'),
      'utf8',
    );

    await writeFile(
      join(claudeCommandsDir, 'issue-analyzer.md'),
      [
        '---',
        'name: forge:issue-analyzer',
        '---',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
      ].join('\n'),
      'utf8',
    );

    const status = await gatherForgeStatus(tempRepoPath, '1.0.0');
    const claude = status.assistants.find((a) => a.id === 'claude');

    expect(claude).toBeDefined();
    expect(claude!.installedPluginIds).toContain('forge-discussion-analyzer');
    expect(claude!.installedPluginIds).toContain('forge-issue-analyzer');
  });

  it('ignores files without managed block markers', async () => {
    const claudeCommandsDir = join(tempHomePath, '.claude/commands/forge');
    await mkdir(claudeCommandsDir, { recursive: true });

    await writeFile(
      join(claudeCommandsDir, 'forge-discussion-analyzer.md'),
      'Just a regular file without managed markers',
      'utf8',
    );

    const status = await gatherForgeStatus(tempRepoPath, '1.0.0');
    const claude = status.assistants.find((a) => a.id === 'claude');

    expect(claude).toBeDefined();
    expect(claude!.installedPluginIds).toEqual([]);
  });

  it('populates plugin status list reflecting installed state', async () => {
    const claudeCommandsDir = join(tempHomePath, '.claude/commands/forge');
    await mkdir(claudeCommandsDir, { recursive: true });
    await writeFile(
      join(claudeCommandsDir, 'release-notes-generator.md'),
      '<!-- BEGIN FORGE MANAGED BLOCK -->\ncontent\n<!-- END FORGE MANAGED BLOCK -->',
      'utf8',
    );

    const status = await gatherForgeStatus(tempRepoPath, '1.0.0');
    const releaseNotes = status.plugins.find((p) => p.id === 'forge-release-notes-generator');

    expect(releaseNotes).toBeDefined();
    expect(releaseNotes!.isInstalled).toBe(true);
    expect(releaseNotes!.groupId).toBe('ops');
  });

  it('produces formatted output from gathered status', async () => {
    const status = await gatherForgeStatus(tempRepoPath, '2.0.0');
    const output = formatStatusOutput(status);

    expect(output).toContain('Forge v2.0.0');
    expect(output).toContain('Assistants:');
    expect(output).toContain('Installed Plugins:');
    expect(output).toContain('Core:');
    expect(output).toContain('Elevate:');
    expect(output).toContain('Ops:');
  });
});
