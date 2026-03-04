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

  it('renders Claude command, agent, workflow, and bundled runtime assets', async () => {
    const [result] = await assistantInstallService.installDefaultSummonables(tempRepoPath, ['claude']);
    const commandPath = join(tempHomePath, '.claude/commands/forge/discussion-analyzer.md');
    const agentPath = join(tempHomePath, '.claude/agents/forge-discussion-analyzer.md');
    const workflowPath = join(tempHomePath, '.claude/forge/workflows/discussion-analyzer.md');
    const runtimeEntryPath = join(tempHomePath, '.claude/forge/bin/forge.mjs');

    expect(result.status).toBe('success');

    const command = await readFile(commandPath, 'utf8');
    const agent = await readFile(agentPath, 'utf8');
    const workflow = await readFile(workflowPath, 'utf8');

    expect(command).toContain('---\nname: forge:discussion-analyzer');
    expect(command).toContain('argument-hint: "<question>"');
    expect(command).toContain(`@${workflowPath}`);
    expect(command).toContain('<!-- BEGIN USER CUSTOMIZATIONS -->');

    expect(agent).toContain('---\nname: forge-discussion-analyzer');
    expect(agent).toContain('tools: Bash, Read');
    expect(agent).toContain('You are the Forge Discussion Analyzer.');
    expect(agent).toContain('node "$HOME/.claude/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "<question>"');
    expect(agent).toContain('<!-- BEGIN USER CUSTOMIZATIONS -->');

    expect(workflow).toContain('node "$HOME/.claude/forge/bin/forge.mjs" --run forge-discussion-analyzer --question "$ARGUMENTS"');
    expect(workflow).toContain('Every query must use Forge live fetches');
    await expect(access(runtimeEntryPath)).resolves.toBeUndefined();
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
});
