import { FileSystemSummary } from '../../contracts/analysis.js';
import { readdir, access } from 'node:fs/promises';
import path from 'node:path';

export class StructureAnalyzer {
  constructor(private repoRoot: string) {}

  async analyze(): Promise<FileSystemSummary> {
    const directories = await this.listTopLevelDirectories();
    const criticalFiles = await this.detectCriticalFiles();
    const entryPoints = await this.detectEntryPoints();

    return {
      directories,
      criticalFiles,
      entryPoints,
    };
  }

  private async listTopLevelDirectories(): Promise<string[]> {
    try {
      const items = await readdir(this.repoRoot, { withFileTypes: true });
      return items
        .filter(item => item.isDirectory() && !item.name.startsWith('.') && item.name !== 'node_modules')
        .map(item => item.name);
    } catch {
      return [];
    }
  }

  private async detectCriticalFiles(): Promise<string[]> {
    const commonCriticalFiles = [
      'tsconfig.json',
      'package.json',
      '.gitignore',
      'README.md',
      'docker-compose.yml',
      'Dockerfile',
      '.env.example',
    ];

    const results: string[] = [];
    for (const file of commonCriticalFiles) {
      try {
        await access(path.join(this.repoRoot, file));
        results.push(file);
      } catch {
        // Continue
      }
    }
    return results;
  }

  private async detectEntryPoints(): Promise<string[]> {
    const entryPointCandidates = [
      'src/index.ts',
      'src/main.ts',
      'src/cli.ts',
      'src/program.ts',
      'index.js',
      'main.js',
    ];

    const results: string[] = [];
    for (const entry of entryPointCandidates) {
      try {
        await access(path.join(this.repoRoot, entry));
        results.push(entry);
      } catch {
        // Continue
      }
    }
    return results;
  }
}
