import { SummonableEntry } from '../../contracts/summonable-entry.js';
import { COPILOT_RUNTIME_ENTRY } from './copilot.js';

export const forgeDiscussionAnalyzerEntry: SummonableEntry = {
  id: 'forge-discussion-analyzer',
  displayName: 'Forge Discussion Analyzer',
  purpose: 'Analyze GitHub Discussions for the current repository through Forge-managed fetching, preprocessing, and compact sidecar context.',
  instructions: [
    'Use this summonable for discussion digests, triage, pattern analysis, and follow-up answers.',
    'If the user asks about GitHub Issues, redirect them to GitHub Discussions instead of pretending this analyzer covers issues.',
    `Treat \`${COPILOT_RUNTIME_ENTRY}\` as the only backend for this workflow.`,
    'Ask for approval once for the Forge command, then let Forge handle fetch plus analysis.',
    'Do not run npm install, repair Forge dependencies, or switch to raw gh api graphql when Forge is available.',
    'Delegate data acquisition, filtering, preprocessing, and freshness handling to Forge.',
    'Suggest narrowing by category, relative windows, or explicit after/before dates when the user needs a smaller slice.',
  ].map((line) => `- ${line}`).join('\n'),
  capabilities: [
    {
      name: 'Discussion Digests',
      description: 'Produces structured summaries and analysis from GitHub Discussions.',
      benefits: ['Scannable summaries', 'Question-driven follow-up analysis'],
    },
    {
      name: 'Compact Context',
      description: 'Uses Forge-prepared sidecar artifacts instead of large static prompt bodies.',
      benefits: ['Lower prompt overhead', 'Reusable repository-local context'],
    },
  ],
  commands: [
    {
      name: '/agent forge-discussion-analyzer',
      description: 'Select the discussion analyzer summonable, then ask a question.',
      usage: `${COPILOT_RUNTIME_ENTRY} --run forge-discussion-analyzer --question "<your question>"`,
      examples: [
        '/agent -> select forge-discussion-analyzer -> "what were the major support themes last week?"',
        `${COPILOT_RUNTIME_ENTRY} --run forge-discussion-analyzer --question "summarize unresolved discussions"`,
      ],
    },
  ],
  principles: [
    'Keep the assistant-facing asset compact and let Forge own the operational backend.',
    'Ground analysis in fetched sidecar artifacts, not in guessed repository state.',
    'Request approval once for the Forge-managed action, not repeatedly for the same analysis flow.',
    'Optimize for high-signal GitHub Discussion summaries and follow-up answers.',
  ],
};

export const forgeSummonableEntries: SummonableEntry[] = [
  forgeDiscussionAnalyzerEntry,
];
