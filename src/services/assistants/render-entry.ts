import { SummonableEntry } from '../../contracts/summonable-entry.js';

/**
 * Shared entry renderer.
 *
 * This service takes a SummonableEntry (assistant-agnostic model) and converts
 * it into a standardized Markdown representation that can be consumed by
 * most AI assistants.
 */
export class EntryRenderer {
  /**
   * Renders a SummonableEntry as a Markdown document.
   *
   * @param entry The summonable entry model.
   * @returns A rendered Markdown string.
   */
  renderToMarkdown(entry: SummonableEntry): string {
    const lines: string[] = [];

    lines.push(`# ${entry.displayName}`);
    lines.push('');
    lines.push(entry.purpose);
    lines.push('');

    lines.push('## Instructions');
    const instructionLines = entry.instructions
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    for (const line of instructionLines) {
      lines.push(line.startsWith('- ') ? line : `- ${line}`);
    }
    lines.push('');

    if (entry.commands.length > 0) {
      lines.push('## Commands');
      lines.push('');
      for (const cmd of entry.commands) {
        lines.push(`- **${cmd.name}**`);
        lines.push(`  ${cmd.description}`);
        lines.push(`  Usage: \`${cmd.usage}\``);
        if (cmd.examples && cmd.examples.length > 0) {
          lines.push('  Examples:');
          for (const example of cmd.examples) {
            lines.push(`  - \`${example}\``);
          }
        }
        lines.push('');
      }
    }

    if (entry.capabilities.length > 0) {
      lines.push('## Capabilities');
      for (const cap of entry.capabilities) {
        lines.push(`- **${cap.name}**: ${cap.description}`);
        for (const benefit of cap.benefits) {
          lines.push(`  - ${benefit}`);
        }
      }
      lines.push('');
    }

    if (entry.principles.length > 0) {
      lines.push('## Principles');
      for (const p of entry.principles) {
        lines.push(`- ${p}`);
      }
      lines.push('');
    }

    return lines.join('\n').trim();
  }
}

export const entryRenderer = new EntryRenderer();
