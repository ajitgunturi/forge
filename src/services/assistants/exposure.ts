import { AssistantId } from '../../contracts/assistants.js';
import { ForgePlugin } from '../../contracts/forge-plugin.js';

export type AssistantSurface = 'agent' | 'command' | 'skill';

export interface ForgePluginRoute {
  namespace: string | null;
  localName: string;
  namespacedName: string;
}

/**
 * Returns the assistant-facing label for a plugin entry and surface.
 */
export function getExposedPluginName(
  assistantId: AssistantId,
  surface: AssistantSurface,
  entry: ForgePlugin,
): string {
  switch (surface) {
    case 'command':
      if (assistantId === 'claude' || assistantId === 'gemini') {
        return toNamespacedPluginName(entry.id);
      }
      return entry.id;
    case 'agent':
    case 'skill':
    default:
      return entry.id;
  }
}

export function toNamespacedPluginName(entryId: string): string {
  const route = getPluginRoute(entryId);
  return route.namespacedName;
}

export function getPluginRoute(entryId: string): ForgePluginRoute {
  const separatorIndex = entryId.indexOf('-');
  if (separatorIndex < 0) {
    return {
      namespace: null,
      localName: entryId,
      namespacedName: entryId,
    };
  }

  return {
    namespace: entryId.slice(0, separatorIndex),
    localName: entryId.slice(separatorIndex + 1),
    namespacedName: `${entryId.slice(0, separatorIndex)}:${entryId.slice(separatorIndex + 1)}`,
  };
}
