import { describe, expect, test } from 'bun:test';

import { ensurePackageResolved } from '@test/support/golden';

describe('ensurePackageResolved', () => {
  // The runner is injected rather than shelling out: what `flutter pub get`
  // does in an empty directory is the tool's business and differs by platform
  // — it exits 1 on macOS and 0 on Linux, which made this assertion pass here
  // and fail in CI. What belongs to us is what we do with the exit code.
  test('fails loudly when the package cannot be resolved', () => {
    expect(
      ensurePackageResolved('/app', () => Promise.resolve(66)),
    ).rejects.toThrow(new Error('flutter pub get failed (exit 66) in /app'));
  });

  test('resolves when pub get succeeds', async () => {
    const commands: [string[], string][] = [];

    await ensurePackageResolved('/app', (command, cwd) => {
      commands.push([command, cwd]);
      return Promise.resolve(0);
    });

    expect(commands).toHaveLength(1);
    expect(commands[0]?.[0].slice(-2)).toEqual(['pub', 'get']);
    expect(commands[0]?.[1]).toBe('/app');
  });
});
