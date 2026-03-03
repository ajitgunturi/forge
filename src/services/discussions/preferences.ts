import { DiscussionCategory } from '../../contracts/discussions.js';
import { readMetadata, writeMetadata } from '../metadata.js';
import { deriveSidecarContext } from '../sidecar.js';

export interface PreferredDiscussionCategory {
  id?: string;
  name: string;
  slug: string;
  savedAt: string;
}

export async function loadPreferredDiscussionCategory(cwd: string): Promise<PreferredDiscussionCategory | undefined> {
  const context = deriveSidecarContext(cwd);
  const metadata = await readMetadata(context.metadataPath);
  return metadata?.discussions?.preferences?.preferredCategory;
}

export async function savePreferredDiscussionCategory(cwd: string, category: DiscussionCategory): Promise<void> {
  const context = deriveSidecarContext(cwd);
  const metadata = await readMetadata(context.metadataPath);
  if (!metadata) {
    return;
  }

  if (!metadata.discussions) {
    metadata.discussions = {
      history: [],
    };
  }

  if (!metadata.discussions.preferences) {
    metadata.discussions.preferences = {};
  }

  metadata.discussions.preferences.preferredCategory = {
    id: category.id,
    name: category.name,
    slug: category.slug,
    savedAt: new Date().toISOString(),
  };
  metadata.updatedAt = new Date().toISOString();

  await writeMetadata(context.metadataPath, metadata);
}
