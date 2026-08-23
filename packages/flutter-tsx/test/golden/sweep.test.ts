import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { transpileComponent } from '@src/compiler/transpile';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { fixturesDir, flutterAnalyze } from '@test/support/golden';

const sweepDir = join(fixturesDir, 'sweep');

// The breadth net of the guarantee model: one minimal usage per widget,
// transpiled and analyzed. RED until the compiler exists (steps 11–21).
describe('543-widget analyze sweep (RED until the compiler exists)', () => {
  test.failing(
    'every complete synthesized example transpiles and analyzes clean',
    async () => {
      const snapshot = await loadApiSnapshot();
      const page = buildSitePage(snapshot, deriveSlots(snapshot));
      const complete = page.widgets.filter((widget) => widget.exampleComplete);
      expect(complete.length).toBeGreaterThanOrEqual(349);

      await rm(sweepDir, { recursive: true, force: true });
      await mkdir(sweepDir, { recursive: true });
      for (const widget of complete) {
        const source =
          `import { ${widget.name}, Text } from 'flutter-tsx';\n\n` +
          `export const Probe = () => (\n  ${widget.tsxExample}\n);\n`;
        const generated = transpileComponent({
          source,
          filePath: `${widget.name}.tsx`,
        });
        await Bun.write(
          join(sweepDir, `${widget.name.toLowerCase()}_probe.dart`),
          generated,
        );
      }

      expect(await flutterAnalyze()).toBe(0);
    },
    900000,
  );
});
