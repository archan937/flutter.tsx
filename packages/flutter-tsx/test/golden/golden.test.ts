import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';
import { listFixtures } from '@test/support/golden';

// Byte-equality against the golden is the complete gate: every committed
// expected.dart is itself proven dart-format-stable and analyze-clean by
// expected-dart.test.ts, so matching it transitively proves both. No
// canonicalization pass — the emitter must produce formatted Dart as-is.
//
// Every committed fixture compiles: a fixture whose support does not exist is
// not committed, so there is no list here to fall out of date, and nothing
// can sit in the repo looking supported while failing.
const fixtures = await listFixtures();

describe('golden fixtures', () => {
  for (const fixture of fixtures) {
    test(`${fixture.id} transpiles to its golden Dart`, async () => {
      const source = await Bun.file(fixture.inputPath).text();
      const expected = await Bun.file(fixture.expectedPath).text();

      expect(
        await transpileComponent({ source, filePath: fixture.inputPath }),
      ).toBe(expected);
    });
  }
});
