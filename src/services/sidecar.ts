import path from 'node:path';
import { SIDECAR_DIR_NAME, METADATA_FILENAME } from '../config/sidecar.js';

/**
 * Resolved paths to the Forge sidecar and its metadata.
 */
export interface SidecarContext {
  /**
   * Root directory of the repository.
   */
  repoPath: string;

  /**
   * Path to the `.forge` sidecar directory.
   */
  sidecarPath: string;

  /**
   * Path to the sidecar's metadata file.
   */
  metadataPath: string;
}

/**
 * Derives the sidecar context from the repository root.
 */
export function deriveSidecarContext(repoRoot: string): SidecarContext {
  const repoPath = path.resolve(repoRoot);
  const sidecarPath = path.join(repoPath, SIDECAR_DIR_NAME);
  const metadataPath = path.join(sidecarPath, METADATA_FILENAME);

  return {
    repoPath,
    sidecarPath,
    metadataPath,
  };
}
