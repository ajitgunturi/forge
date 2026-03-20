import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assistantInstallService } from '../../../src/services/assistants/install.js';

describe('Claude assistant translation', () => {
  let tempRepoPath: string;
  let tempHomePath: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-claude-repo-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-claude-home-'));
    process.env.HOME = tempHomePath;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempRepoPath, { recursive: true, force: true });
    await rm(tempHomePath, { recursive: true, force: true });
  });

  it('renders Claude command, agent, and workflow assets with direct gh guidance', async () => {
    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);
    const discussionCommandPath = join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md');
    const discussionAgentPath = join(tempHomePath, '.claude/agents/forge-discussion-analyzer.md');
    const discussionWorkflowPath = join(tempHomePath, '.claude/forge/workflows/discussion-analyzer.md');
    const issueCommandPath = join(tempHomePath, '.claude/commands/forge/issue-analyzer.md');
    const issueAgentPath = join(tempHomePath, '.claude/agents/forge-issue-analyzer.md');
    const prAgentPath = join(tempHomePath, '.claude/agents/forge-pr-comments-analyzer.md');
    const prWorkflowPath = join(tempHomePath, '.claude/forge/workflows/pr-comments-analyzer.md');

    expect(result.status).toBe('success');

    const discussionCommand = await readFile(discussionCommandPath, 'utf8');
    const discussionAgent = await readFile(discussionAgentPath, 'utf8');
    const discussionWorkflow = await readFile(discussionWorkflowPath, 'utf8');
    const issueCommand = await readFile(issueCommandPath, 'utf8');
    const issueAgent = await readFile(issueAgentPath, 'utf8');
    const prAgent = await readFile(prAgentPath, 'utf8');
    const prWorkflow = await readFile(prWorkflowPath, 'utf8');

    expect(discussionCommand).toContain('---\nname: forge:discussion-analyzer');
    expect(discussionCommand).toContain(`@${discussionWorkflowPath}`);
    expect(discussionCommand).toContain('Analyze GitHub Discussions for the current repository using read-only gh CLI live fetches.');
    expect(discussionAgent).toContain('You are the Forge Discussion Analyzer.');
    expect(discussionAgent).toContain('`gh api graphql`');
    expect(discussionAgent).not.toContain('forge.mjs');
    expect(discussionAgent).not.toContain('--run');
    expect(discussionWorkflow).toContain('gh api graphql');
    expect(discussionWorkflow).not.toContain('forge.mjs');

    expect(issueCommand).toContain('---\nname: forge:issue-analyzer');
    expect(issueAgent).toContain('`gh issue list`');
    expect(issueAgent).not.toContain('forge.mjs');

    expect(prAgent).toContain('`gh pr view`');
    expect(prWorkflow).toContain('gh api repos/{owner}/{repo}/pulls/<pr>/comments');
    expect(prWorkflow).not.toContain('forge.mjs');

    await expect(access(join(tempHomePath, '.claude/forge/bin/forge.mjs'))).rejects.toThrow();
    await expect(access(join(tempHomePath, '.claude/skills/forge:discussion-analyzer/SKILL.md'))).rejects.toThrow();
  });

  it('preserves Claude command and agent customizations on reinstall', async () => {
    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);

    const commandPath = join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md');
    const agentPath = join(tempHomePath, '.claude/agents/forge-discussion-analyzer.md');

    await writeFile(
      commandPath,
      (await readFile(commandPath, 'utf8')).replace(
        '<!-- Add team- or user-specific Claude command instructions below this line. -->',
        'Team Claude command instruction: keep summaries under five bullets.',
      ),
      'utf8',
    );

    await writeFile(
      agentPath,
      (await readFile(agentPath, 'utf8')).replace(
        '<!-- Add team- or user-specific Claude agent instructions below this line. -->',
        'Team Claude agent instruction: always mention the repository owner.',
      ),
      'utf8',
    );

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);

    expect(result.status).toBe('skipped');
    expect(await readFile(commandPath, 'utf8')).toContain('Team Claude command instruction: keep summaries under five bullets.');
    expect(await readFile(agentPath, 'utf8')).toContain('Team Claude agent instruction: always mention the repository owner.');
  });

  it('migrates legacy Claude skill and namespaced agent customizations into the new command and agent', async () => {
    const legacyAgentPath = join(tempHomePath, '.claude/agents/forge:discussion-analyzer.md');
    const legacySkillDir = join(tempHomePath, '.claude/skills/forge:discussion-analyzer');
    const migratedCommandPath = join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md');
    const migratedAgentPath = join(tempHomePath, '.claude/agents/forge-discussion-analyzer.md');

    await mkdir(join(tempHomePath, '.claude/agents'), { recursive: true });
    await mkdir(legacySkillDir, { recursive: true });
    await writeFile(
      legacyAgentPath,
      [
        '---',
        'name: forge:discussion-analyzer',
        'description: legacy',
        'tools: Bash, Read',
        '---',
        '',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy managed agent',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team legacy Claude agent customization',
        '<!-- END USER CUSTOMIZATIONS -->',
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      join(legacySkillDir, 'SKILL.md'),
      [
        '---',
        'name: forge:discussion-analyzer',
        'description: legacy',
        'allowed-tools: Bash, Read',
        '---',
        '',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy managed command',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team legacy Claude command customization',
        '<!-- END USER CUSTOMIZATIONS -->',
        '',
      ].join('\n'),
      'utf8',
    );

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);

    expect(result.status).toBe('success');
    expect(await readFile(migratedCommandPath, 'utf8')).toContain('Team legacy Claude command customization');
    expect(await readFile(migratedAgentPath, 'utf8')).toContain('Team legacy Claude agent customization');
    await expect(access(legacyAgentPath)).rejects.toThrow();
    await expect(access(legacySkillDir)).rejects.toThrow();
  });

  it('removes legacy Claude runtime artifacts while keeping workflow files', async () => {
    const forgeRoot = join(tempHomePath, '.claude/forge');
    await mkdir(join(forgeRoot, 'bin'), { recursive: true });
    await mkdir(join(forgeRoot, 'dist'), { recursive: true });
    await mkdir(join(forgeRoot, 'node_modules/pkg'), { recursive: true });
    await writeFile(join(forgeRoot, 'bin/forge.mjs'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'dist/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'node_modules/pkg/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'VERSION'), '1.0.0\n', 'utf8');
    await writeFile(join(forgeRoot, 'package.json'), '{}', 'utf8');
    await writeFile(join(forgeRoot, 'forge-file-manifest.json'), '{}', 'utf8');

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);

    expect(result.status).toBe('success');
    await expect(access(join(forgeRoot, 'bin/forge.mjs'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'dist'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'node_modules'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'VERSION'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'package.json'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'forge-file-manifest.json'))).rejects.toThrow();
    await expect(access(join(forgeRoot, 'workflows/discussion-analyzer.md'))).resolves.toBeUndefined();
  });
});
