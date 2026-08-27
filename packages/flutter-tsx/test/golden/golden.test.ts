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
const GREEN_FIXTURES = new Set([
  '01-camera-screen',
  '02-hello-column',
  '03-styled-container',
  '04-inline-handler',
  '05-counter',
  '06-mount-effect',
  '07-list-rendering',
  '08-composition',
  '09-typed-props',
  '10-camera-options',
  '11-preferences',
  '12-secure-storage',
  '13-open-link',
  '14-app-info',
  '15-front-camera',
  '16-tap-target',
  '17-async-token',
  '18-connectivity-stream',
  '19-store-counter',
  '20-router',
  '21-modal',
  '22-mount-dialog',
  '23-tabs',
  '24-animated',
  '25-http-get',
]);

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
