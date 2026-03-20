import fs from 'node:fs/promises';
import path from 'node:path';
import { assistantRegistry } from '../services/assistants/registry.js';
import { AssistantId, AssistantInstallLayout } from '../contracts/assistants.js';
import {
  forgePlugins,
  getPluginGroupInfo,
  PluginGroupInfo,
} from '../services/assistants/summonables.js';
import { FORGE_MANAGED_START } from '../services/assistants/copilot.js';

export interface AssistantStatusInfo {
  id: AssistantId;
  name: string;
  isAvailable: boolean;
  rootPath: string;
  installedPluginIds: string[];
}

export interface PluginStatusInfo {
  id: string;
  displayName: string;
  groupId: string;
  groupLabel: string;
  isInstalled: boolean;
}

export interface ForgeStatus {
  version: string;
  assistants: AssistantStatusInfo[];
  plugins: PluginStatusInfo[];
}

export async function gatherForgeStatus(cwd: string, version: string): Promise<ForgeStatus> {
  const adapters = assistantRegistry.listAdapters();
  const assistants: AssistantStatusInfo[] = [];

  for (const adapter of adapters) {
    const availability = await adapter.checkAvailability();
    const layout = adapter.resolveInstallLayout(cwd);
    const installedPluginIds = await scanInstalledPlugins(layout);

    assistants.push({
      id: adapter.id,
      name: adapter.name,
      isAvailable: availability.isAvailable,
      rootPath: layout.rootPath,
      installedPluginIds,
    });
  }

  const groupInfos = getPluginGroupInfo();
  const allInstalledIds = new Set(assistants.flatMap((a) => a.installedPluginIds));
  const plugins = buildPluginStatusList(groupInfos, allInstalledIds);

  return { version, assistants, plugins };
}

async function scanInstalledPlugins(layout: AssistantInstallLayout): Promise<string[]> {
  const searchPaths = [
    layout.commandsPath,
    layout.agentsPath,
    layout.skillsPath,
    layout.workflowsPath,
  ].filter((p): p is string => Boolean(p));

  const foundPluginIds = new Set<string>();

  for (const searchPath of searchPaths) {
    const files = await listFilesRecursive(searchPath);
    for (const filePath of files) {
      const content = await safeReadFile(filePath);
      if (content && content.includes(FORGE_MANAGED_START)) {
        const pluginId = matchPluginId(filePath, content);
        if (pluginId) {
          foundPluginIds.add(pluginId);
        }
      }
    }
  }

  return Array.from(foundPluginIds);
}

function matchPluginId(filePath: string, _content: string): string | null {
  const knownIds = forgePlugins.map((p) => p.id);
  const fileName = path.basename(filePath, path.extname(filePath));

  for (const id of knownIds) {
    if (filePath.includes(id)) {
      return id;
    }
    const localName = id.replace(/^[^-]+-/, '');
    if (fileName === localName) {
      return id;
    }
  }
  return null;
}

async function listFilesRecursive(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        files.push(...await listFilesRecursive(fullPath));
      } else {
        files.push(fullPath);
      }
    }
    return files;
  } catch {
    return [];
  }
}

async function safeReadFile(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function buildPluginStatusList(
  groupInfos: PluginGroupInfo[],
  installedIds: Set<string>,
): PluginStatusInfo[] {
  const plugins: PluginStatusInfo[] = [];
  for (const group of groupInfos) {
    for (const plugin of group.plugins) {
      plugins.push({
        id: plugin.id,
        displayName: plugin.displayName,
        groupId: group.id,
        groupLabel: group.label,
        isInstalled: installedIds.has(plugin.id),
      });
    }
  }
  return plugins;
}

export function formatStatusOutput(status: ForgeStatus): string {
  const lines: string[] = [];

  lines.push(`Forge v${status.version}`);
  lines.push('');
  lines.push('Assistants:');

  for (const assistant of status.assistants) {
    const icon = assistant.isAvailable
      ? assistant.installedPluginIds.length > 0 ? '✓' : '○'
      : '○';
    const pluginCount = assistant.installedPluginIds.length;
    const suffix = assistant.isAvailable
      ? pluginCount > 0
        ? `${tildeHomePath(assistant.rootPath)}  (${pluginCount} plugin${pluginCount !== 1 ? 's' : ''})`
        : `${tildeHomePath(assistant.rootPath)}  (no plugins installed)`
      : 'not detected';

    lines.push(`  ${icon} ${assistant.name.padEnd(12)} ${suffix}`);
  }

  lines.push('');
  lines.push('Installed Plugins:');

  const grouped = groupBy(status.plugins, (p) => p.groupLabel);
  for (const [groupLabel, plugins] of Object.entries(grouped)) {
    lines.push(`  ${groupLabel}:`);
    for (const plugin of plugins) {
      if (plugin.isInstalled) {
        lines.push(`    ✓ ${plugin.id}`);
      } else {
        const groupId = plugin.groupId;
        lines.push(`    ○ ${plugin.id.padEnd(40)} (install with --plugins ${groupId})`);
      }
    }
  }

  return lines.join('\n');
}

function tildeHomePath(fullPath: string): string {
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  if (home && fullPath.startsWith(home)) {
    return `~${fullPath.slice(home.length)}`;
  }
  return fullPath;
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {};
  for (const item of items) {
    const key = keyFn(item);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(item);
  }
  return result;
}

export async function statusCommand(
  cwd: string,
  options: { version: string },
): Promise<void> {
  const status = await gatherForgeStatus(cwd, options.version);
  console.log(formatStatusOutput(status));
}
