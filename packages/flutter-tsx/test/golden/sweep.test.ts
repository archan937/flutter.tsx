import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { transpileComponent } from '@src/compiler/transpile';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import {
  ensurePackageResolved,
  flutterAnalyze,
  sweepPackageDir,
} from '@test/support/golden';

const probesDir = join(sweepPackageDir, 'probes');

// The breadth net of the guarantee model: one minimal usage per widget,
// transpiled and analyzed in its own Dart package. RED until the compiler
// emits every probe analyze-clean (steps 14–21).
describe('543-widget analyze sweep (RED until every probe analyzes clean)', () => {
  test.failing(
    'every complete synthesized example transpiles and analyzes clean',
    async () => {
      const snapshot = await loadApiSnapshot();
      const page = buildSitePage(snapshot, deriveSlots(snapshot));
      const complete = page.widgets.filter((widget) => widget.exampleComplete);
      expect(complete.length).toBeGreaterThanOrEqual(349);

      await ensurePackageResolved(sweepPackageDir);
      await rm(probesDir, { recursive: true, force: true });
      await mkdir(probesDir, { recursive: true });
      for (const widget of complete) {
        const source =
          `import { ${widget.name}, Text } from 'flutter-tsx';\n\n` +
          `export const Probe = () => (\n  ${widget.tsxExample}\n);\n`;
        const generated = await transpileComponent({
          source,
          filePath: `${widget.name}.tsx`,
        });
        await Bun.write(
          join(probesDir, `${widget.name.toLowerCase()}_probe.dart`),
          generated,
        );
      }

      expect(await flutterAnalyze(sweepPackageDir)).toBe(0);
    },
    900000,
  );
});
