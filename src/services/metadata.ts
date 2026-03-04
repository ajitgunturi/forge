import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

/**
 * Sidecar metadata version.
 */
export const METADATA_VERSION = '1.0';
export const INSTALLER_METADATA_VERSION = '1.0';

/**
 * Metadata schema using Zod for validation.
 * Captures Forge's initialization state and run history within a repository.
 */
export const SidecarMetadataSchema = z.object({
  /**
   * Schema version.
   */
  version: z.string(),

  /**
   * ISO 8601 timestamp of sidecar creation.
   */
  createdAt: z.string().datetime(),

  /**
   * ISO 8601 timestamp of last update.
   */
  updatedAt: z.string().datetime(),

  /**
   * Details about the initial bootstrap run.
   */
  bootstrap: z.object({
    completedAt: z.string().datetime(),
    repoRootPath: z.string(),
  }).optional(),

  /**
   * Summary of repository analysis runs.
   * Full payloads live in separate artifact files.
   */
  analysis: z.object({
    lastRunId: z.string().optional(),
    history: z.array(z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      commitHash: z.string().optional(),
      artifactPath: z.string(),
    })).default([]),
  }).optional(),

  /**
   * Summary of generated action plans.
   */
  planning: z.object({
    lastPlanId: z.string().optional(),
    history: z.array(z.object({
      id: z.string(),
      timestamp: z.string().datetime(),
      analysisRunId: z.string(),
      artifactPath: z.string(),
    })).default([]),
  }).optional(),

  /**
   * Arbitrary history of Forge runs against this repository.
   */
  history: z.array(z.object({
    type: z.string(),
    timestamp: z.string().datetime(),
    payload: z.record(z.string(), z.unknown()).optional(),
  })),
});

/**
 * Type inferred from the schema.
 */
export type SidecarMetadata = z.infer<typeof SidecarMetadataSchema>;

export const InstallerRuntimeMetadataSchema = z.object({
  version: z.string(),
  installedAt: z.string().datetime(),
  installRoot: z.string(),
  runtimePath: z.string(),
  runtimeEntryPath: z.string(),
  agentsPath: z.string(),
  commandsPath: z.string().optional(),
  skillsPath: z.string().optional(),
  workflowsPath: z.string().optional(),
  summonables: z.array(z.string()).default([]),
  bundledFiles: z.array(z.string()).default([]),
});

export type InstallerRuntimeMetadata = z.infer<typeof InstallerRuntimeMetadataSchema>;

/**
 * Reads sidecar metadata from the specified path.
 * Returns null if the file does not exist.
 */
export async function readMetadata(metadataPath: string): Promise<SidecarMetadata | null> {
  try {
    const content = await readFile(metadataPath, 'utf8');
    const json = JSON.parse(content);
    return SidecarMetadataSchema.parse(json);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    // If it exists but fails validation/parsing, let it throw
    throw error;
  }
}

/**
 * Writes sidecar metadata atomically using temp-file and rename semantics.
 * Ensures the sidecar directory exists before writing.
 */
export async function writeMetadata(metadataPath: string, metadata: SidecarMetadata): Promise<void> {
  // Validate before writing to prevent corrupting state with invalid data
  SidecarMetadataSchema.parse(metadata);

  const dir = path.dirname(metadataPath);
  await mkdir(dir, { recursive: true });

  const tempPath = `${metadataPath}.${Math.random().toString(36).slice(2)}.tmp`;
  const content = JSON.stringify(metadata, null, 2);

  try {
    await writeFile(tempPath, content, 'utf8');
    await rename(tempPath, metadataPath);
  } catch (error) {
    // If rename failed, the temp file might still be there; we leave it for investigation
    // but propagate the error to prevent caller from thinking it succeeded.
    throw error;
  }
}

/**
 * Initializes a new metadata object with default values.
 */
export function createNewMetadata(): SidecarMetadata {
  const now = new Date().toISOString();
  return {
    version: METADATA_VERSION,
    createdAt: now,
    updatedAt: now,
    history: [],
  };
}

export async function readInstallerRuntimeMetadata(metadataPath: string): Promise<InstallerRuntimeMetadata | null> {
  try {
    const content = await readFile(metadataPath, 'utf8');
    return InstallerRuntimeMetadataSchema.parse(JSON.parse(content));
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }

    throw error;
  }
}

export async function writeInstallerRuntimeMetadata(
  metadataPath: string,
  metadata: InstallerRuntimeMetadata,
): Promise<void> {
  InstallerRuntimeMetadataSchema.parse(metadata);
  const dir = path.dirname(metadataPath);
  await mkdir(dir, { recursive: true });

  const tempPath = `${metadataPath}.${Math.random().toString(36).slice(2)}.tmp`;
  const content = JSON.stringify(metadata, null, 2);

  await writeFile(tempPath, content, 'utf8');
  await rename(tempPath, metadataPath);
}

export function createInstallerRuntimeMetadata(input: Omit<InstallerRuntimeMetadata, 'version' | 'installedAt'>): InstallerRuntimeMetadata {
  return {
    version: INSTALLER_METADATA_VERSION,
    installedAt: new Date().toISOString(),
    ...input,
  };
}
