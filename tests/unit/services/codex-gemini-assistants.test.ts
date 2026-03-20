import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { assistantInstallService } from '../../../src/services/assistants/install.js';

describe('Codex assistant translation', () => {
  let tempRepoPath: string;
  let tempHomePath: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-codex-repo-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-codex-home-'));
    process.env.HOME = tempHomePath;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempRepoPath, { recursive: true, force: true });
    await rm(tempHomePath, { recursive: true, force: true });
  });

  it('renders Codex skill, agent, TOML, and workflow assets with direct gh guidance', async () => {
    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);
    const discussionSkillPath = join(tempHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md');
    const discussionAgentPath = join(tempHomePath, '.codex/agents/forge-discussion-analyzer.md');
    const discussionAgentTomlPath = join(tempHomePath, '.codex/agents/forge-discussion-analyzer.toml');
    const discussionWorkflowPath = join(tempHomePath, '.codex/forge/workflows/discussion-analyzer.md');
    const issueWorkflowPath = join(tempHomePath, '.codex/forge/workflows/issue-analyzer.md');
    const prAgentPath = join(tempHomePath, '.codex/agents/forge-pr-comments-analyzer.md');
    const prSkillPath = join(tempHomePath, '.codex/skills/forge-pr-comments-analyzer/SKILL.md');

    expect(result.status).toBe('success');

    const discussionSkill = await readFile(discussionSkillPath, 'utf8');
    const discussionAgent = await readFile(discussionAgentPath, 'utf8');
    const discussionAgentToml = await readFile(discussionAgentTomlPath, 'utf8');
    const discussionWorkflow = await readFile(discussionWorkflowPath, 'utf8');
    const issueWorkflow = await readFile(issueWorkflowPath, 'utf8');
    const prAgent = await readFile(prAgentPath, 'utf8');
    const prSkill = await readFile(prSkillPath, 'utf8');

    expect(discussionSkill).toContain('`$forge-discussion-analyzer`');
    expect(discussionSkill).toContain(`@${discussionWorkflowPath}`);
    expect(discussionSkill).toContain('gh api graphql');
    expect(discussionSkill).not.toContain('forge.mjs');
    expect(discussionAgent).toContain('<codex_agent_role>');
    expect(discussionAgent).toContain('`gh api graphql`');
    expect(discussionAgent).not.toContain('forge.mjs');
    expect(discussionAgentToml).toContain('sandbox_mode = "workspace-write"');
    expect(discussionAgentToml).toContain('`gh api graphql`');
    expect(discussionAgentToml).not.toContain('forge.mjs');
    expect(discussionWorkflow).toContain('gh api graphql');
    expect(issueWorkflow).toContain('gh issue list');
    expect(prAgent).toContain('`gh pr view`');
    expect(prSkill).toContain('gh pr view');

    await expect(access(join(tempHomePath, '.codex/forge/bin/forge.mjs'))).rejects.toThrow();
  });

  it('preserves Codex skill customizations on reinstall', async () => {
    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);
    const skillPath = join(tempHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md');

    await writeFile(
      skillPath,
      (await readFile(skillPath, 'utf8')).replace(
        '<!-- Add team- or user-specific Codex skill instructions below this line. -->',
        'Team Codex skill instruction: mention the repository name first.',
      ),
      'utf8',
    );

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);

    expect(result.status).toBe('skipped');
    expect(await readFile(skillPath, 'utf8')).toContain('Team Codex skill instruction: mention the repository name first.');
  });

  it('migrates legacy Codex root files into the new skill and removes repo-local legacy directories when empty', async () => {
    const legacyRepoDir = join(tempRepoPath, '.codex');
    const legacyRepoPath = join(legacyRepoDir, 'forge:discussion-analyzer.md');
    const legacyGlobalPath = join(tempHomePath, '.codex/forge-discussion-analyzer.md');
    const skillPath = join(tempHomePath, '.codex/skills/forge-discussion-analyzer/SKILL.md');

    await mkdir(legacyRepoDir, { recursive: true });
    await mkdir(join(tempHomePath, '.codex'), { recursive: true });
    await writeFile(
      legacyRepoPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy repo managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team repo Codex customization',
        '<!-- END USER CUSTOMIZATIONS -->',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      legacyGlobalPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy global managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team global Codex customization',
        '<!-- END USER CUSTOMIZATIONS -->',
      ].join('\n'),
      'utf8',
    );

    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);

    expect(await readFile(skillPath, 'utf8')).toContain('Team repo Codex customization');
    await expect(access(legacyRepoPath)).rejects.toThrow();
    await expect(access(legacyGlobalPath)).rejects.toThrow();
    await expect(access(legacyRepoDir)).rejects.toThrow();
  });

  it('repairs an existing Codex skill file that was previously installed without YAML frontmatter', async () => {
    const skillDir = join(tempHomePath, '.codex/skills/forge-discussion-analyzer');
    const skillPath = join(skillDir, 'SKILL.md');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      skillPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team Codex customization to preserve',
        '<!-- END USER CUSTOMIZATIONS -->',
        '',
      ].join('\n'),
      'utf8',
    );

    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);

    const skill = await readFile(skillPath, 'utf8');
    expect(skill).toContain('---\nname: "forge-discussion-analyzer"');
    expect(skill).toContain('metadata:');
    expect(skill).toContain('Team Codex customization to preserve');
    expect(skill.match(/<!-- BEGIN FORGE MANAGED BLOCK -->/g)).toHaveLength(1);
    expect(skill.match(/<!-- BEGIN USER CUSTOMIZATIONS -->/g)).toHaveLength(1);
    expect(skill).not.toContain('legacy managed content');
  });

  it('repairs an existing Codex skill file whose user block was polluted by nested Forge markers', async () => {
    const skillDir = join(tempHomePath, '.codex/skills/forge-discussion-analyzer');
    const skillPath = join(skillDir, 'SKILL.md');
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      skillPath,
      [
        '---',
        'name: "forge-discussion-analyzer"',
        'description: "legacy"',
        'metadata:',
        '  short-description: "legacy"',
        '---',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy nested managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team Codex customization to preserve',
        '<!-- END USER CUSTOMIZATIONS -->',
        '<!-- END USER CUSTOMIZATIONS -->',
        '',
      ].join('\n'),
      'utf8',
    );

    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);

    const skill = await readFile(skillPath, 'utf8');
    expect(skill.match(/<!-- BEGIN FORGE MANAGED BLOCK -->/g)).toHaveLength(1);
    expect(skill.match(/<!-- BEGIN USER CUSTOMIZATIONS -->/g)).toHaveLength(1);
    expect(skill).toContain('Team Codex customization to preserve');
    expect(skill).not.toContain('legacy nested managed content');
  });

  it('removes legacy Codex runtime artifacts while keeping workflows', async () => {
    const forgeRoot = join(tempHomePath, '.codex/forge');
    await mkdir(join(forgeRoot, 'bin'), { recursive: true });
    await mkdir(join(forgeRoot, 'dist'), { recursive: true });
    await mkdir(join(forgeRoot, 'node_modules/pkg'), { recursive: true });
    await writeFile(join(forgeRoot, 'bin/forge.mjs'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'dist/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'node_modules/pkg/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'VERSION'), '1.0.0\n', 'utf8');
    await writeFile(join(forgeRoot, 'package.json'), '{}', 'utf8');
    await writeFile(join(forgeRoot, 'forge-file-manifest.json'), '{}', 'utf8');

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['codex']);

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

describe('Gemini assistant translation', () => {
  let tempRepoPath: string;
  let tempHomePath: string;
  const originalHome = process.env.HOME;

  beforeEach(async () => {
    tempRepoPath = await mkdtemp(join(tmpdir(), 'forge-gemini-repo-'));
    tempHomePath = await mkdtemp(join(tmpdir(), 'forge-gemini-home-'));
    process.env.HOME = tempHomePath;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await rm(tempRepoPath, { recursive: true, force: true });
    await rm(tempHomePath, { recursive: true, force: true });
  });

  it('renders Gemini command, agent, and workflow assets with direct gh guidance', async () => {
    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);
    const discussionCommandPath = join(tempHomePath, '.gemini/commands/forge/discussion-analyzer.toml');
    const discussionAgentPath = join(tempHomePath, '.gemini/agents/forge-discussion-analyzer.md');
    const discussionWorkflowPath = join(tempHomePath, '.gemini/forge/workflows/discussion-analyzer.md');
    const issueCommandPath = join(tempHomePath, '.gemini/commands/forge/issue-analyzer.toml');
    const prCommandPath = join(tempHomePath, '.gemini/commands/forge/pr-comments-analyzer.toml');

    expect(result.status).toBe('success');

    const discussionCommand = await readFile(discussionCommandPath, 'utf8');
    const discussionAgent = await readFile(discussionAgentPath, 'utf8');
    const discussionWorkflow = await readFile(discussionWorkflowPath, 'utf8');
    const issueCommand = await readFile(issueCommandPath, 'utf8');
    const prCommand = await readFile(prCommandPath, 'utf8');

    expect(discussionCommand).toContain('gh api graphql');
    expect(discussionCommand).not.toContain('forge.mjs');
    expect(discussionAgent).toContain('tools:\n  - read_file\n  - run_shell_command');
    expect(discussionAgent).toContain('`gh api graphql`');
    expect(discussionAgent).not.toContain('forge.mjs');
    expect(discussionWorkflow).toContain('gh api graphql');
    expect(issueCommand).toContain('gh issue list');
    expect(prCommand).toContain('gh pr view');

    await expect(access(join(tempHomePath, '.gemini/forge/bin/forge.mjs'))).rejects.toThrow();
  });

  it('preserves Gemini agent customizations on reinstall', async () => {
    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);
    const agentPath = join(tempHomePath, '.gemini/agents/forge-discussion-analyzer.md');

    await writeFile(
      agentPath,
      (await readFile(agentPath, 'utf8')).replace(
        '<!-- Add team- or user-specific Gemini agent instructions below this line. -->',
        'Team Gemini agent instruction: mention categories before date windows.',
      ),
      'utf8',
    );

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);

    expect(result.status).toBe('skipped');
    expect(await readFile(agentPath, 'utf8')).toContain('Team Gemini agent instruction: mention categories before date windows.');
  });

  it('migrates legacy Gemini root files into the new agent and removes repo-local legacy directories when empty', async () => {
    const legacyRepoDir = join(tempRepoPath, '.gemini');
    const legacyRepoPath = join(legacyRepoDir, 'forge:discussion-analyzer.md');
    const legacyGlobalPath = join(tempHomePath, '.gemini/forge-discussion-analyzer.md');
    const agentPath = join(tempHomePath, '.gemini/agents/forge-discussion-analyzer.md');

    await mkdir(legacyRepoDir, { recursive: true });
    await mkdir(join(tempHomePath, '.gemini'), { recursive: true });
    await writeFile(
      legacyRepoPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy repo managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team repo Gemini customization',
        '<!-- END USER CUSTOMIZATIONS -->',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      legacyGlobalPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy global managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team global Gemini customization',
        '<!-- END USER CUSTOMIZATIONS -->',
      ].join('\n'),
      'utf8',
    );

    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);

    expect(await readFile(agentPath, 'utf8')).toContain('Team repo Gemini customization');
    await expect(access(legacyRepoPath)).rejects.toThrow();
    await expect(access(legacyGlobalPath)).rejects.toThrow();
    await expect(access(legacyRepoDir)).rejects.toThrow();
  });

  it('repairs an existing Gemini agent file that was previously installed without YAML frontmatter', async () => {
    const agentDir = join(tempHomePath, '.gemini/agents');
    const agentPath = join(agentDir, 'forge-discussion-analyzer.md');
    await mkdir(agentDir, { recursive: true });
    await writeFile(
      agentPath,
      [
        '<!-- BEGIN FORGE MANAGED BLOCK -->',
        'legacy managed content',
        '<!-- END FORGE MANAGED BLOCK -->',
        '',
        '<!-- BEGIN USER CUSTOMIZATIONS -->',
        'Team Gemini customization to preserve',
        '<!-- END USER CUSTOMIZATIONS -->',
        '',
      ].join('\n'),
      'utf8',
    );

    await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);

    const agent = await readFile(agentPath, 'utf8');
    expect(agent).toContain('---\nname: forge-discussion-analyzer');
    expect(agent).toContain('tools:\n  - read_file\n  - run_shell_command');
    expect(agent).toContain('Team Gemini customization to preserve');
    expect(agent.match(/<!-- BEGIN USER CUSTOMIZATIONS -->/g)).toHaveLength(1);
  });

  it('removes legacy Gemini runtime artifacts while keeping workflows', async () => {
    const forgeRoot = join(tempHomePath, '.gemini/forge');
    await mkdir(join(forgeRoot, 'bin'), { recursive: true });
    await mkdir(join(forgeRoot, 'dist'), { recursive: true });
    await mkdir(join(forgeRoot, 'node_modules/pkg'), { recursive: true });
    await writeFile(join(forgeRoot, 'bin/forge.mjs'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'dist/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'node_modules/pkg/index.js'), 'legacy', 'utf8');
    await writeFile(join(forgeRoot, 'VERSION'), '1.0.0\n', 'utf8');
    await writeFile(join(forgeRoot, 'package.json'), '{}', 'utf8');
    await writeFile(join(forgeRoot, 'forge-file-manifest.json'), '{}', 'utf8');

    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['gemini']);

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
