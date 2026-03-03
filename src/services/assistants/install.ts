import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assistantRegistry, AssistantAdapter } from './registry.js';
import { AssistantId, AssistantInstallLayout, AssistantOperationResult } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { forgeSummonableEntries } from './summonables.js';
import {
  createInstallerRuntimeMetadata,
  readInstallerRuntimeMetadata,
  writeInstallerRuntimeMetadata,
} from '../metadata.js';
import {
  COPILOT_RUNTIME_ENTRY,
  FORGE_MANAGED_END,
  FORGE_MANAGED_START,
  FORGE_USER_END,
  FORGE_USER_START,
  LEGACY_COPILOT_AGENT_IDS,
} from './copilot.js';

/**
 * AssistantInstallService: Orchestrates the installation and update of 
 * AI assistant runtime entries across the supported assistant set.
 */
export class AssistantInstallService {
  getSupportedAssistantIds(): AssistantId[] {
    return assistantRegistry.listCapabilities().map((capability) => capability.id);
  }

  /**
   * Installs or updates all supported assistant entries for a given summonable entry.
   *
   * This method iterates over the registered assistant adapters, 
   * checks their availability, renders native assets, and writes
   * them to their target locations.
   *
   * @param cwd The project root directory
   * @param entry The summonable entry to install/update
   * @returns Structured results for each assistant target
   */
  async installAll(cwd: string, entry: SummonableEntry): Promise<AssistantOperationResult[]> {
    return this.installSelected(cwd, entry, this.getSupportedAssistantIds());
  }

  async installSelected(
    cwd: string,
    entry: SummonableEntry,
    assistantIds: AssistantId[]
  ): Promise<AssistantOperationResult[]> {
    return this.installEntriesSelected(cwd, [entry], assistantIds);
  }

  async installDefaultSummonables(cwd: string, assistantIds: AssistantId[]): Promise<AssistantOperationResult[]> {
    return this.installEntriesSelected(cwd, forgeSummonableEntries, assistantIds);
  }

  async installEntriesSelected(
    cwd: string,
    entries: SummonableEntry[],
    assistantIds: AssistantId[]
  ): Promise<AssistantOperationResult[]> {
    const results: AssistantOperationResult[] = [];

    for (const assistantId of assistantIds) {
      const adapter = assistantRegistry.get(assistantId);
      if (!adapter) {
        results.push({
          id: assistantId,
          status: 'failed',
          message: `Adapter for assistant '${assistantId}' not found in registry.`,
        });
        continue;
      }

      try {
        const result = await this.installMany(cwd, entries, adapter);
        results.push(result);
      } catch (error) {
        results.push({
          id: adapter.id,
          status: 'failed',
          message: `Error installing/updating ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  async installMany(
    cwd: string,
    entries: SummonableEntry[],
    adapter: AssistantAdapter
  ): Promise<AssistantOperationResult> {
    const availability = await adapter.checkAvailability();

    if (!availability.isAvailable) {
      return {
        id: adapter.id,
        status: 'no-op',
        message: availability.reason || `Assistant ${adapter.name} is not available in the current environment.`,
      };
    }

    const layout = adapter.resolveInstallLayout(cwd);
    const bootstrap = await this.prepareRuntime(adapter, layout, entries);

    let installedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const entry of entries) {
      const result = await this.installOne(cwd, entry, adapter);
      if (result.status === 'failed') {
        return result;
      }
      if (result.status === 'success') {
        if (result.message.includes('updated')) {
          updatedCount += 1;
        } else {
          installedCount += 1;
        }
      } else if (result.status === 'skipped') {
        skippedCount += 1;
      }
    }

    if (installedCount === 0 && updatedCount === 0) {
      return {
        id: adapter.id,
        status: 'skipped',
        message: `${adapter.name} summonables are already up to date (${skippedCount} checked).`,
      };
    }

    const segments = [
      installedCount > 0 ? `${installedCount} installed` : null,
      updatedCount > 0 ? `${updatedCount} updated` : null,
      skippedCount > 0 ? `${skippedCount} unchanged` : null,
    ].filter(Boolean);

    return {
      id: adapter.id,
      status: 'success',
      message: `${adapter.name} summonables ready at ${layout.rootPath} (${segments.join(', ')}).`,
      details: bootstrap,
    };
  }

  async installOne(cwd: string, entry: SummonableEntry, adapter: AssistantAdapter): Promise<AssistantOperationResult> {
    const availability = await adapter.checkAvailability();
    
    if (!availability.isAvailable) {
      return {
        id: adapter.id,
        status: 'no-op',
        message: availability.reason || `Assistant ${adapter.name} is not available in the current environment.`,
      };
    }

    const targetPath = adapter.getInstallTarget(cwd, entry);
    const content = adapter.render(entry);

    try {
      // Ensure the directory exists
      await fs.mkdir(path.dirname(targetPath), { recursive: true });

      // Check if file already exists
      let existingContent: string | null = null;
      try {
        existingContent = await fs.readFile(targetPath, 'utf8');
      } catch (error) {
        // File does not exist, which is fine
      }

      const nextContent = this.mergeManagedContent(adapter, content, existingContent);

      if (existingContent === nextContent) {
        return {
          id: adapter.id,
          status: 'skipped',
          message: `${adapter.name} entry is already up to date.`,
          filePath: targetPath,
        };
      }

      // Write or update the file
      await fs.writeFile(targetPath, nextContent, 'utf8');

      return {
        id: adapter.id,
        status: 'success',
        message: existingContent === null
          ? `installed ${adapter.name} summonables at ${path.dirname(targetPath)}.`
          : `updated ${adapter.name} summonables at ${path.dirname(targetPath)}.`,
        filePath: targetPath,
      };
    } catch (error) {
      return {
        id: adapter.id,
        status: 'failed',
        message: `Failed to write ${adapter.name} entry to ${targetPath}: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private mergeManagedContent(adapter: AssistantAdapter, renderedContent: string, existingContent: string | null): string {
    if (adapter.id !== 'copilot' || existingContent === null) {
      return renderedContent;
    }

    if (existingContent.includes(FORGE_MANAGED_START) && existingContent.includes(FORGE_MANAGED_END)) {
      return replaceManagedBlock(existingContent, renderedContent);
    }

    return migrateLegacyContent(renderedContent, existingContent);
  }

  private async prepareRuntime(
    adapter: AssistantAdapter,
    layout: AssistantInstallLayout,
    entries: SummonableEntry[],
  ): Promise<string[]> {
    if (adapter.id !== 'copilot' || !layout.runtimePath || !layout.runtimeEntryPath || !layout.metadataPath || !layout.versionPath) {
      return [];
    }

    const details: string[] = [];
    const directories = [layout.rootPath, layout.agentsPath, layout.runtimePath, path.dirname(layout.runtimeEntryPath)];

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        details.push(`created ${dir}`);
      }
    }

    const packageRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const bundledDistPath = fileURLToPath(new URL('../../../dist', import.meta.url));
    const runtimeDistPath = path.join(layout.runtimePath, 'dist');
    const bundledNodeModulesPath = path.join(packageRoot, 'node_modules');
    const runtimeNodeModulesPath = path.join(layout.runtimePath, 'node_modules');
    await fs.rm(runtimeDistPath, { recursive: true, force: true });
    await fs.cp(bundledDistPath, runtimeDistPath, { recursive: true });
    details.push(`installed bundled runtime to ${runtimeDistPath}`);
    await fs.rm(runtimeNodeModulesPath, { recursive: true, force: true });
    await fs.cp(bundledNodeModulesPath, runtimeNodeModulesPath, { recursive: true });
    details.push(`installed bundled dependencies to ${runtimeNodeModulesPath}`);

    const manifestRaw = await fs.readFile(path.join(packageRoot, 'package.json'), 'utf8');
    const manifest = JSON.parse(manifestRaw) as {
      name?: string;
      version?: string;
      dependencies?: Record<string, string>;
    };

    await fs.writeFile(
      path.join(layout.runtimePath, 'package.json'),
      JSON.stringify(
        {
          name: manifest.name ?? 'forge-ai-assist',
          version: manifest.version ?? '0.0.0',
          type: 'module',
          private: true,
          dependencies: manifest.dependencies ?? {},
        },
        null,
        2,
      ),
      'utf8',
    );

    const wrapper = [
      '#!/usr/bin/env node',
      '',
      "import '../dist/cli.js';",
      '',
    ].join('\n');
    await fs.writeFile(layout.runtimeEntryPath, wrapper, 'utf8');
    details.push(`wrote runtime entry ${layout.runtimeEntryPath}`);

    await fs.writeFile(layout.versionPath, `${manifest.version ?? '0.0.0'}\n`, 'utf8');
    details.push(`wrote VERSION (${manifest.version ?? '0.0.0'})`);

    for (const legacyAgentId of LEGACY_COPILOT_AGENT_IDS) {
      const legacyAgentPath = path.join(layout.agentsPath, `${legacyAgentId}.agent.md`);
      try {
        await fs.rm(legacyAgentPath, { force: true });
        details.push(`removed obsolete agent ${legacyAgentPath}`);
      } catch {
        // Ignore cleanup failures so the runtime install can still succeed.
      }
    }

    const existingMetadata = await readInstallerRuntimeMetadata(layout.metadataPath);
    const bundledFiles = [
      path.relative(layout.rootPath, runtimeDistPath),
      path.relative(layout.rootPath, runtimeNodeModulesPath),
      path.relative(layout.rootPath, layout.runtimeEntryPath),
      path.relative(layout.rootPath, layout.versionPath),
      path.relative(layout.rootPath, path.join(layout.runtimePath, 'package.json')),
    ];

    await writeInstallerRuntimeMetadata(
      layout.metadataPath,
      createInstallerRuntimeMetadata({
        installRoot: layout.rootPath,
        runtimePath: layout.runtimePath,
        runtimeEntryPath: layout.runtimeEntryPath,
        agentsPath: layout.agentsPath,
        summonables: entries.map((entry) => entry.id),
        bundledFiles,
      }),
    );

    if (existingMetadata === null) {
      details.push(`wrote manifest ${layout.metadataPath}`);
    } else {
      details.push(`updated manifest ${layout.metadataPath}`);
    }

    details.push(`bundled tool entry: ${COPILOT_RUNTIME_ENTRY.replace('$HOME', os.homedir())}`);
    return details;
  }
}

function replaceManagedBlock(existingContent: string, renderedContent: string): string {
  const renderedManaged = extractManagedSection(renderedContent);
  const existingManaged = extractManagedSection(existingContent);

  if (!renderedManaged || !existingManaged) {
    return renderedContent;
  }

  const withManagedUpdated = existingContent.replace(existingManaged.fullMatch, renderedManaged.fullMatch);
  const renderedUser = extractUserSection(renderedContent);
  const existingUser = extractUserSection(withManagedUpdated);

  if (!existingUser && renderedUser) {
    return `${withManagedUpdated.trimEnd()}\n\n${renderedUser.fullMatch}\n`;
  }

  return withManagedUpdated;
}

function migrateLegacyContent(renderedContent: string, existingContent: string): string {
  const frontmatterMatch = renderedContent.match(/^---\n[\s\S]*?\n---\n/);
  const renderedManaged = extractManagedSection(renderedContent);
  const renderedUser = extractUserSection(renderedContent);

  if (!frontmatterMatch || !renderedManaged || !renderedUser) {
    return renderedContent;
  }

  const userContent = stripYamlFrontmatter(existingContent).trim();
  const migratedUser = userContent
    ? `${FORGE_USER_START}\n${userContent}\n${FORGE_USER_END}`
    : renderedUser.fullMatch;

  return `${frontmatterMatch[0]}${renderedManaged.fullMatch}\n\n${migratedUser}\n`;
}

function extractManagedSection(content: string): { fullMatch: string } | null {
  const match = content.match(new RegExp(`${escapeForRegex(FORGE_MANAGED_START)}[\\s\\S]*?${escapeForRegex(FORGE_MANAGED_END)}`));
  return match ? { fullMatch: match[0] } : null;
}

function extractUserSection(content: string): { fullMatch: string } | null {
  const match = content.match(new RegExp(`${escapeForRegex(FORGE_USER_START)}[\\s\\S]*?${escapeForRegex(FORGE_USER_END)}`));
  return match ? { fullMatch: match[0] } : null;
}

function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const assistantInstallService = new AssistantInstallService();
