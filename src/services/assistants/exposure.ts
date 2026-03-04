import { AssistantId } from '../../contracts/assistants.js';
import { SummonableEntry } from '../../contracts/summonable-entry.js';

export type AssistantSurface = 'agent' | 'command' | 'skill';

export interface SummonableRoute {
  namespace: string | null;
  localName: string;
  namespacedName: string;
}

/**
 * Returns the assistant-facing label for a summonable entry and surface.
 */
export function getExposedSummonableName(
  assistantId: AssistantId,
  surface: AssistantSurface,
  entry: SummonableEntry,
): string {
  switch (surface) {
    case 'command':
      if (assistantId === 'claude' || assistantId === 'gemini') {
        return toNamespacedSummonableName(entry.id);
      }
      return entry.id;
    case 'agent':
    case 'skill':
    default:
      return entry.id;
  }
}

export function toNamespacedSummonableName(entryId: string): string {
  const route = getSummonableRoute(entryId);
  return route.namespacedName;
}

export function getSummonableRoute(entryId: string): SummonableRoute {
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
