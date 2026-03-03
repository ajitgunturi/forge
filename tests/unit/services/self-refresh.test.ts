import { describe, expect, it } from 'vitest';
import { compareVersions, shouldCheckForLatest } from '../../../src/services/self-refresh.js';

describe('self-refresh', () => {
  it('compares semantic versions numerically', () => {
    expect(compareVersions('1.1.2', '1.1.2')).toBe(0);
    expect(compareVersions('1.1.3', '1.1.2')).toBe(1);
    expect(compareVersions('1.1.2', '1.2.0')).toBe(-1);
    expect(compareVersions('v1.10.0', '1.9.9')).toBe(1);
  });

  it('checks latest only for npx-style cached executions', () => {
    expect(shouldCheckForLatest(['node', '/Users/me/.npm/_npx/abc/node_modules/.bin/forge'], {})).toBe(true);
    expect(shouldCheckForLatest(['node', '/Users/me/project/dist/cli.js'], {})).toBe(false);
    expect(
      shouldCheckForLatest(
        ['node', '/Users/me/.npm/_npx/abc/node_modules/.bin/forge'],
        { FORGE_SKIP_SELF_REFRESH: '1' },
      ),
    ).toBe(false);
    expect(
      shouldCheckForLatest(
        ['node', '/Users/me/.npm/_npx/abc/node_modules/.bin/forge'],
        { FORGE_SELF_REFRESHED: '1' },
      ),
    ).toBe(false);
  });
});
