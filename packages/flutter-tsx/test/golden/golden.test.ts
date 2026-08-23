import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';
import { listFixtures } from '@test/support/golden';

const fixtures = await listFixtures();

// Byte-equality against the golden is the complete gate: every committed
// expected.dart is itself proven dart-format-stable and analyze-clean by
// expected-dart.test.ts, so matching it transitively proves both.
//
// `test.failing` keeps the suite green while the compiler does not exist and
// fails loudly the moment a fixture unexpectedly passes — forcing the flip to
// a plain `test` when steps 11–21 earn it.
describe('golden fixtures (RED until the compiler exists)', () => {
  for (const fixture of fixtures) {
    test.failing(`${fixture.id} transpiles to its golden Dart`, async () => {
      const source = await Bun.file(fixture.inputPath).text();
      const expected = await Bun.file(fixture.expectedPath).text();

      const generated = transpileComponent({
        source,
        filePath: fixture.inputPath,
      });

      expect(generated).toBe(expected);
    });
  }
});
