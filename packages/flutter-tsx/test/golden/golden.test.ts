import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';
import { listFixtures } from '@test/support/golden';

// Byte-equality against the golden is the complete gate: every committed
// expected.dart is itself proven dart-format-stable and analyze-clean by
// expected-dart.test.ts, so matching it transitively proves both. No
// canonicalization pass — the emitter must produce formatted Dart as-is.
//
// Fixtures outside GREEN_FIXTURES run as `test.failing`: the suite stays
// green while their compiler support does not exist yet and fails loudly the
// moment one unexpectedly passes — forcing the flip into GREEN_FIXTURES.
const GREEN_FIXTURES = new Set(['02-hello-column', '03-styled-container']);

const fixtures = await listFixtures();

describe('golden fixtures', () => {
  for (const fixture of fixtures) {
    const runner = GREEN_FIXTURES.has(fixture.id) ? test : test.failing;
    runner(`${fixture.id} transpiles to its golden Dart`, async () => {
      const source = await Bun.file(fixture.inputPath).text();
      const expected = await Bun.file(fixture.expectedPath).text();

      expect(
        await transpileComponent({ source, filePath: fixture.inputPath }),
      ).toBe(expected);
    });
  }
});
