import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  readMetadata, 
  writeMetadata, 
  createNewMetadata, 
  SidecarMetadataSchema, 
  METADATA_VERSION 
} from '../../../src/services/metadata.js';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ZodError } from 'zod';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  mkdir: vi.fn(),
}));

describe('MetadataService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validMetadata = {
    version: METADATA_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };

  describe('SidecarMetadataSchema', () => {
    it('validates a correct metadata object', () => {
      const result = SidecarMetadataSchema.safeParse(validMetadata);
      expect(result.success).toBe(true);
    });

    it('fails validation if version is missing', () => {
      const { version, ...invalid } = validMetadata as any;
      const result = SidecarMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('fails validation if createdAt is not a valid datetime', () => {
      const invalid = { ...validMetadata, createdAt: 'not-a-date' };
      const result = SidecarMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('readMetadata', () => {
    it('reads and parses valid metadata', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(validMetadata));

      const metadata = await readMetadata('/path/to/metadata.json');

      expect(metadata).toEqual(validMetadata);
      expect(readFile).toHaveBeenCalledWith('/path/to/metadata.json', 'utf8');
    });

    it('returns null if file does not exist', async () => {
      const error = new Error('ENOENT');
      (error as any).code = 'ENOENT';
      vi.mocked(readFile).mockRejectedValue(error);

      const metadata = await readMetadata('/path/to/metadata.json');

      expect(metadata).toBeNull();
    });

    it('throws if JSON is invalid', async () => {
      vi.mocked(readFile).mockResolvedValue('invalid-json');

      await expect(readMetadata('/path/to/metadata.json')).rejects.toThrow();
    });

    it('throws if schema validation fails', async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({ version: 'unknown' }));

      await expect(readMetadata('/path/to/metadata.json')).rejects.toThrow(ZodError);
    });
  });

  describe('writeMetadata', () => {
    it('writes metadata atomically', async () => {
      vi.mocked(writeFile).mockResolvedValue(undefined);
      vi.mocked(rename).mockResolvedValue(undefined);
      vi.mocked(mkdir).mockResolvedValue(undefined);

      await writeMetadata('/path/to/metadata.json', validMetadata);

      expect(mkdir).toHaveBeenCalledWith('/path/to', { recursive: true });
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringMatching(/\/path\/to\/metadata\.json\..*\.tmp/),
        JSON.stringify(validMetadata, null, 2),
        'utf8'
      );
      expect(rename).toHaveBeenCalledWith(
        expect.stringMatching(/\/path\/to\/metadata\.json\..*\.tmp/),
        '/path/to/metadata.json'
      );
    });

    it('throws validation error before writing', async () => {
      const invalidMetadata = { ...validMetadata, version: undefined } as any;

      await expect(writeMetadata('/path/to/metadata.json', invalidMetadata)).rejects.toThrow(ZodError);
      expect(writeFile).not.toHaveBeenCalled();
    });

    it('propagates filesystem errors', async () => {
      vi.mocked(writeFile).mockRejectedValue(new Error('Write failed'));

      await expect(writeMetadata('/path/to/metadata.json', validMetadata)).rejects.toThrow('Write failed');
    });
  });

  describe('createNewMetadata', () => {
    it('returns a new metadata object with default values', () => {
      const metadata = createNewMetadata();

      expect(metadata.version).toBe(METADATA_VERSION);
      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBe(metadata.createdAt);
      expect(metadata.history).toEqual([]);
      
      // Verify it's a valid ISO string
      expect(new Date(metadata.createdAt).toISOString()).toBe(metadata.createdAt);
    });
  });
});
