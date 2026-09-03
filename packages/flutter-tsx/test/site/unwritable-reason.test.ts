import { describe, expect, test } from 'bun:test';

import { unwritableReason } from '@src/site/unwritable';

/**
 * Which of the three a value that could not be written is.
 *
 * The reference has none of them today, and this is the classifier that
 * would name the next one: a Future or a Stream a hook writes, a type
 * nothing constructs that Flutter therefore supplies, and everything else,
 * which is work.
 */
describe('unwritableReason', () => {
  const nothingBuilds = new Map();

  test('a Future or a Stream is written by a hook', () => {
    expect(
      unwritableReason(
        { kind: 'future', item: { kind: 'void' } },
        nothingBuilds,
      ),
    ).toBe('written-by-a-hook');
    expect(
      unwritableReason(
        { kind: 'stream', item: { kind: 'void' } },
        nothingBuilds,
      ),
    ).toBe('written-by-a-hook');
  });

  test('a nullable type is classified by what it holds', () => {
    expect(
      unwritableReason(
        { kind: 'nullable', inner: { kind: 'future', item: { kind: 'void' } } },
        nothingBuilds,
      ),
    ).toBe('written-by-a-hook');
  });

  test('a type nothing constructs is one Flutter supplies', () => {
    expect(
      unwritableReason({ kind: 'named', name: 'FlutterView' }, nothingBuilds),
    ).toBe('supplied-by-flutter');
  });

  test('a type something constructs is a shape not yet written', () => {
    expect(
      unwritableReason(
        { kind: 'named', name: 'Ink' },
        new Map([['Ink', [{ name: 'InkSplash', typeParams: [], params: [] }]]]),
      ),
    ).toBe('not-yet-expressible');
  });

  test('anything with no name at all is a shape not yet written', () => {
    expect(unwritableReason({ kind: 'unknown' }, nothingBuilds)).toBe(
      'not-yet-expressible',
    );
  });
});
