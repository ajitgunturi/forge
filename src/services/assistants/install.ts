import fs from 'node:fs/promises';
import path from 'node:path';
import { assistantRegistry, AssistantAdapter, AssistantSupplementalAsset } from './registry.js';
import { AssistantId, AssistantInstallLayout, AssistantOperationResult } from '../../contracts/assistants.js';
import { ForgePlugin } from '../../contracts/forge-plugin.js';
import { forgePlugins } from './summonables.js';
import {
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
  async installAll(cwd: string, entry: ForgePlugin): Promise<AssistantOperationResult[]> {
    return this.installSelected(cwd, entry, this.getSupportedAssistantIds());
  }

  async installSelected(
    cwd: string,
    entry: ForgePlugin,
    assistantIds: AssistantId[]
  ): Promise<AssistantOperationResult[]> {
    return this.installEntriesSelected(cwd, [entry], assistantIds);
  }

  async installDefaultSummonables(cwd: string, assistantIds: AssistantId[]): Promise<AssistantOperationResult[]> {
    return this.installEntriesSelected(cwd, forgePlugins, assistantIds);
  }

  async uninstallDefaultSummonables(cwd: string, assistantIds: AssistantId[]): Promise<AssistantOperationResult[]> {
    return this.uninstallEntriesSelected(cwd, forgePlugins, assistantIds);
  }

  async installEntriesSelected(
    cwd: string,
    entries: ForgePlugin[],
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

  async uninstallEntriesSelected(
    cwd: string,
    entries: ForgePlugin[],
    assistantIds: AssistantId[],
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
        const result = await this.uninstallMany(cwd, entries, adapter);
        results.push(result);
      } catch (error) {
        results.push({
          id: adapter.id,
          status: 'failed',
          message: `Error removing ${adapter.name}: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    }

    return results;
  }

  async installMany(
    cwd: string,
    entries: ForgePlugin[],
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
    const bootstrap = await this.prepareInstallLayout(layout);

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

    const obsoleteDirectories = adapter.getObsoleteDirectoryPaths?.(cwd) ?? [];
    for (const directoryPath of obsoleteDirectories) {
      await removeDirectoryIfEmpty(directoryPath);
    }

    if (installedCount === 0 && updatedCount === 0 && bootstrap.length === 0) {
      return {
        id: adapter.id,
        status: 'skipped',
        message: `${adapter.name} assistant assets are already up to date (${skippedCount} checked).`,
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
      message: `${adapter.name} assistant assets ready at ${layout.rootPath} (${segments.join(', ')}).`,
      details: bootstrap,
    };
  }

  async uninstallMany(
    cwd: string,
    entries: ForgePlugin[],
    adapter: AssistantAdapter,
  ): Promise<AssistantOperationResult> {
    const layout = adapter.resolveInstallLayout(cwd);
    const details: string[] = [];
    let removedCount = 0;

    for (const entry of entries) {
      const managedAssetPaths = this.getManagedAssetPaths(cwd, entry, adapter);

      for (const managedAssetPath of managedAssetPaths) {
        const removed = await removePathIfExists(managedAssetPath);
        if (!removed) {
          continue;
        }

        removedCount += 1;
        details.push(`removed ${managedAssetPath}`);
        await pruneEmptyParents(path.dirname(managedAssetPath), resolvePruneBoundary(managedAssetPath, layout.rootPath, cwd));
      }
    }

    const legacyDetails = await this.removeLegacyRuntimeArtifacts(layout);
    removedCount += legacyDetails.length;
    details.push(...legacyDetails);

    for (const legacyAgentId of LEGACY_COPILOT_AGENT_IDS) {
      const legacyAgentPath = path.join(layout.agentsPath, `${legacyAgentId}.agent.md`);
      const removed = await removePathIfExists(legacyAgentPath);
      if (!removed) {
        continue;
      }

      removedCount += 1;
      details.push(`removed obsolete agent ${legacyAgentPath}`);
      await pruneEmptyParents(path.dirname(legacyAgentPath), layout.rootPath);
    }

    const obsoleteDirectories = adapter.getObsoleteDirectoryPaths?.(cwd) ?? [];
    for (const directoryPath of obsoleteDirectories) {
      await removeDirectoryIfEmpty(directoryPath);
    }

    if (removedCount === 0) {
      return {
        id: adapter.id,
        status: 'skipped',
        message: `No Forge ${adapter.name} assets were found under ${layout.rootPath}.`,
      };
    }

    return {
      id: adapter.id,
      status: 'success',
      message: `Removed Forge ${adapter.name} assets from ${layout.rootPath} (${removedCount} deleted).`,
      details,
    };
  }

  async installOne(cwd: string, entry: ForgePlugin, adapter: AssistantAdapter): Promise<AssistantOperationResult> {
    const availability = await adapter.checkAvailability();
    
    if (!availability.isAvailable) {
      return {
        id: adapter.id,
        status: 'no-op',
        message: availability.reason || `Assistant ${adapter.name} is not available in the current environment.`,
      };
    }

    const primaryAsset: AssistantSupplementalAsset = {
      targetPath: adapter.getInstallTarget(cwd, entry),
      content: adapter.render(entry),
    };
    const supplementalAssets = adapter.getSupplementalAssets?.(cwd, entry) ?? [];
    const migrationSources = adapter.getAssetMigrationSources?.(cwd, entry) ?? {};
    const currentAssetPaths = new Set([primaryAsset.targetPath, ...supplementalAssets.map((asset) => asset.targetPath)]);
    const obsoleteAssetPaths = (adapter.getObsoleteAssetPaths?.(cwd, entry) ?? []).filter(
      (assetPath) => !currentAssetPaths.has(assetPath),
    );
    const targetPath = primaryAsset.targetPath;

    try {
      const layout = adapter.resolveInstallLayout(cwd);
      const writeResults = [];
      for (const asset of [primaryAsset, ...supplementalAssets]) {
        writeResults.push(await this.writeManagedAsset(adapter, asset, migrationSources[asset.targetPath] ?? []));
      }

      for (const obsoleteAssetPath of obsoleteAssetPaths) {
        const removed = await removePathIfExists(obsoleteAssetPath);
        if (removed) {
          await pruneEmptyParents(
            path.dirname(obsoleteAssetPath),
            resolvePruneBoundary(obsoleteAssetPath, layout.rootPath, cwd),
          );
        }
      }

      if (writeResults.every((result) => result.status === 'skipped')) {
        return {
          id: adapter.id,
          status: 'skipped',
          message: `${adapter.name} entry is already up to date.`,
          filePath: targetPath,
        };
      }

      const installedAsset = writeResults.find((result) => result.status === 'installed');
      const updatedAsset = writeResults.find((result) => result.status === 'updated');
      const changedAsset = installedAsset ?? updatedAsset ?? writeResults[0];

      return {
        id: adapter.id,
        status: 'success',
        message: installedAsset
          ? `installed ${adapter.name} assistant assets at ${path.dirname(changedAsset.targetPath)}.`
          : `updated ${adapter.name} assistant assets at ${path.dirname(changedAsset.targetPath)}.`,
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

  private getManagedAssetPaths(cwd: string, entry: ForgePlugin, adapter: AssistantAdapter): string[] {
    const primaryAssetPath = adapter.getInstallTarget(cwd, entry);
    const supplementalAssetPaths = (adapter.getSupplementalAssets?.(cwd, entry) ?? []).map((asset) => asset.targetPath);
    const obsoleteAssetPaths = adapter.getObsoleteAssetPaths?.(cwd, entry) ?? [];

    return Array.from(new Set([primaryAssetPath, ...supplementalAssetPaths, ...obsoleteAssetPaths]));
  }

  private mergeManagedContent(_adapter: AssistantAdapter, renderedContent: string, existingContent: string | null): string {
    if (existingContent === null) {
      return renderedContent;
    }

    if (!renderedContent.includes(FORGE_MANAGED_START) || !renderedContent.includes(FORGE_MANAGED_END)) {
      return renderedContent;
    }

    if (requiresFrontmatterMigration(renderedContent, existingContent)) {
      return migrateLegacyContent(renderedContent, existingContent);
    }

    if (existingContent.includes(FORGE_MANAGED_START) && existingContent.includes(FORGE_MANAGED_END)) {
      return replaceManagedBlock(existingContent, renderedContent);
    }

    return migrateLegacyContent(renderedContent, existingContent);
  }

  private async writeManagedAsset(
    adapter: AssistantAdapter,
    asset: AssistantSupplementalAsset,
    migrationSourcePaths: string[] = [],
  ): Promise<{ status: 'installed' | 'updated' | 'skipped'; targetPath: string }> {
    await fs.mkdir(path.dirname(asset.targetPath), { recursive: true });

    let existingContent: string | null = null;
    let targetExists = true;
    try {
      existingContent = await fs.readFile(asset.targetPath, 'utf8');
    } catch {
      // File does not exist yet.
      targetExists = false;
    }

    if (existingContent === null) {
      for (const sourcePath of migrationSourcePaths) {
        try {
          existingContent = await fs.readFile(sourcePath, 'utf8');
          break;
        } catch {
          // Try the next migration source.
        }
      }
    }

    const nextContent = this.mergeManagedContent(adapter, asset.content, existingContent);
    if (targetExists && existingContent === nextContent) {
      return {
        status: 'skipped',
        targetPath: asset.targetPath,
      };
    }

    await fs.writeFile(asset.targetPath, nextContent, 'utf8');
    return {
      status: targetExists ? 'updated' : 'installed',
      targetPath: asset.targetPath,
    };
  }

  private async prepareInstallLayout(layout: AssistantInstallLayout): Promise<string[]> {
    const details: string[] = [];
    const directories = [
      layout.rootPath,
      layout.agentsPath,
      layout.commandsPath,
      layout.skillsPath,
      layout.workflowsPath,
    ].filter((value): value is string => Boolean(value));

    for (const dir of directories) {
      try {
        await fs.access(dir);
      } catch {
        await fs.mkdir(dir, { recursive: true });
        details.push(`created ${dir}`);
      }
    }
    details.push(...await this.removeLegacyRuntimeArtifacts(layout));

    for (const legacyAgentId of LEGACY_COPILOT_AGENT_IDS) {
      const legacyAgentPath = path.join(layout.agentsPath, `${legacyAgentId}.agent.md`);
      try {
        await fs.access(legacyAgentPath);
        await fs.rm(legacyAgentPath, { force: true });
        details.push(`removed obsolete agent ${legacyAgentPath}`);
      } catch {
        // Ignore cleanup failures so the runtime install can still succeed.
      }
    }
    return details;
  }

  private async removeLegacyRuntimeArtifacts(layout: AssistantInstallLayout): Promise<string[]> {
    const legacyRuntimeRoot = path.join(layout.rootPath, 'forge');
    const obsoletePaths = [
      path.join(legacyRuntimeRoot, 'bin'),
      path.join(legacyRuntimeRoot, 'dist'),
      path.join(legacyRuntimeRoot, 'node_modules'),
      path.join(legacyRuntimeRoot, 'VERSION'),
      path.join(legacyRuntimeRoot, 'package.json'),
      path.join(legacyRuntimeRoot, 'forge-file-manifest.json'),
    ];
    const details: string[] = [];

    for (const obsoletePath of obsoletePaths) {
      try {
        await fs.access(obsoletePath);
      } catch {
        continue;
      }

      await fs.rm(obsoletePath, { recursive: true, force: true });
      details.push(`removed legacy runtime ${obsoletePath}`);
    }

    await removeDirectoryIfEmpty(path.join(legacyRuntimeRoot, 'bin'));
    await removeDirectoryIfEmpty(legacyRuntimeRoot);
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

  if (existingUser && renderedUser) {
    const normalizedUserContent = extractLegacyUserContent(existingUser.innerContent);
    const normalizedUserSection = normalizedUserContent
      ? `${FORGE_USER_START}\n${normalizedUserContent}\n${FORGE_USER_END}`
      : renderedUser.fullMatch;

    if (normalizedUserSection !== existingUser.fullMatch) {
      return withManagedUpdated.replace(existingUser.fullMatch, normalizedUserSection);
    }
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

  const userContent = extractLegacyUserContent(existingContent);
  const migratedUser = userContent
    ? `${FORGE_USER_START}\n${userContent}\n${FORGE_USER_END}`
    : renderedUser.fullMatch;

  return `${frontmatterMatch[0]}${renderedManaged.fullMatch}\n\n${migratedUser}\n`;
}

function extractManagedSection(content: string): { fullMatch: string; innerContent: string } | null {
  const match = content.match(
    new RegExp(`(${escapeForRegex(FORGE_MANAGED_START)})\\n?([\\s\\S]*?)\\n?(${escapeForRegex(FORGE_MANAGED_END)})`),
  );
  return match ? { fullMatch: match[0], innerContent: match[2] ?? '' } : null;
}

function extractUserSection(content: string): { fullMatch: string; innerContent: string } | null {
  const startIndex = content.indexOf(FORGE_USER_START);
  if (startIndex < 0) {
    return null;
  }

  const endIndex = content.lastIndexOf(FORGE_USER_END);
  if (endIndex < 0 || endIndex < startIndex) {
    return null;
  }

  const fullMatch = content.slice(startIndex, endIndex + FORGE_USER_END.length);
  const innerStartIndex = startIndex + FORGE_USER_START.length;
  const innerContent = content.slice(innerStartIndex, endIndex).replace(/^\n/, '').replace(/\n$/, '');

  return {
    fullMatch,
    innerContent,
  };
}

function stripYamlFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, '');
}

function extractLegacyUserContent(existingContent: string): string {
  const existingUser = extractUserSection(existingContent);
  if (existingUser) {
    return existingUser.innerContent.trim();
  }

  let userContent = stripYamlFrontmatter(existingContent);
  const existingManaged = extractManagedSection(userContent);
  if (existingManaged) {
    userContent = userContent.replace(existingManaged.fullMatch, '');
  }

  return userContent
    .replace(FORGE_USER_START, '')
    .replace(FORGE_USER_END, '')
    .trim();
}

function hasYamlFrontmatter(content: string): boolean {
  return /^---\n[\s\S]*?\n---\n?/.test(content);
}

function requiresFrontmatterMigration(renderedContent: string, existingContent: string): boolean {
  return hasYamlFrontmatter(renderedContent) && !hasYamlFrontmatter(existingContent);
}

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function removeDirectoryIfEmpty(directoryPath: string): Promise<void> {
  try {
    await fs.rmdir(directoryPath);
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error) {
      const errorCode = String((error as { code?: string }).code);
      if (errorCode === 'ENOENT' || errorCode === 'ENOTEMPTY') {
        return;
      }
    }
    throw error;
  }
}

async function removePathIfExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
  } catch {
    return false;
  }

  await fs.rm(targetPath, { recursive: true, force: true });
  return true;
}

async function pruneEmptyParents(startDirectoryPath: string, stopBeforePath: string): Promise<void> {
  const normalizedStopBeforePath = path.resolve(stopBeforePath);
  let currentDirectoryPath = path.resolve(startDirectoryPath);

  while (currentDirectoryPath !== normalizedStopBeforePath) {
    await removeDirectoryIfEmpty(currentDirectoryPath);
    const parentDirectoryPath = path.dirname(currentDirectoryPath);

    if (parentDirectoryPath === currentDirectoryPath) {
      return;
    }

    currentDirectoryPath = parentDirectoryPath;
  }
}

function resolvePruneBoundary(targetPath: string, assistantRootPath: string, cwd: string): string {
  const normalizedTargetPath = path.resolve(targetPath);
  const normalizedAssistantRootPath = path.resolve(assistantRootPath);
  const normalizedCwd = path.resolve(cwd);

  if (
    normalizedTargetPath === normalizedAssistantRootPath
    || normalizedTargetPath.startsWith(`${normalizedAssistantRootPath}${path.sep}`)
  ) {
    return normalizedAssistantRootPath;
  }

  if (normalizedTargetPath === normalizedCwd || normalizedTargetPath.startsWith(`${normalizedCwd}${path.sep}`)) {
    return normalizedCwd;
  }

  return path.dirname(normalizedTargetPath);
}

export const assistantInstallService = new AssistantInstallService();
