import { describe, expect, test } from 'bun:test';

import { runCommand } from '@scripts/run-command';

describe('runCommand', () => {
  test('returns 0 for a succeeding command', async () => {
    expect(await runCommand(['true'], '.')).toBe(0);
  });

  test('returns the exit code of a failing command', async () => {
    expect(await runCommand(['false'], '.')).toBe(1);
  });
});
