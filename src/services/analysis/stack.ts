import { TechnologyStack } from '../../contracts/analysis.js';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';

export class StackAnalyzer {
  constructor(private repoRoot: string) {}

  async analyze(): Promise<TechnologyStack> {
    const packageJson = await this.readPackageJson();
    const packageManager = await this.detectPackageManager();

    const frameworks: string[] = [];
    const tools: string[] = [];

    if (packageJson) {
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Framework detection
      if (deps['next']) frameworks.push('nextjs');
      if (deps['react']) frameworks.push('react');
      if (deps['express']) frameworks.push('express');
      if (deps['vue']) frameworks.push('vue');

      // Tool detection
      if (deps['typescript']) tools.push('typescript');
      if (deps['eslint']) tools.push('eslint');
      if (deps['jest']) tools.push('jest');
      if (deps['vitest']) tools.push('vitest');
      if (deps['prettier']) tools.push('prettier');
    }

    return {
      language: packageJson ? 'typescript' : 'unknown', // Defaulting to TS for this repo context
      frameworks,
      tools,
      packageManager,
    };
  }

  private async readPackageJson(): Promise<any | null> {
    try {
      const content = await readFile(path.join(this.repoRoot, 'package.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async detectPackageManager(): Promise<string | undefined> {
    const files = [
      { name: 'package-lock.json', manager: 'npm' },
      { name: 'yarn.lock', manager: 'yarn' },
      { name: 'pnpm-lock.yaml', manager: 'pnpm' },
      { name: 'bun.lockb', manager: 'bun' },
    ];

    for (const file of files) {
      try {
        await access(path.join(this.repoRoot, file.name));
        return file.manager;
      } catch {
        // Continue
      }
    }

    return undefined;
  }
}
