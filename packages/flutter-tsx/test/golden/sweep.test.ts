import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { transpileComponent } from '@src/compiler/transpile';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { loadSiteSections } from '@src/site/sections';
import { exampleImports, exampleSource } from '@src/site/synthesize';
import {
  ensurePackageResolved,
  flutterAnalyze,
  sweepPackageDir,
} from '@test/support/golden';

const probesDir = join(sweepPackageDir, 'probes');

// The breadth net of the guarantee model: one minimal usage per widget,
// transpiled and analyzed in its own Dart package. GREEN since step 23 —
// every complete synthesized example emits Dart that analyzes clean, and any
// regression fails here loudly. Examples whose values the compiler cannot
// express yet are marked incomplete (visible {…} placeholders in the docs),
// never silently included.
describe('543-widget analyze sweep', () => {
  // The timeout is generous because coverage instrumentation makes the fresh
  // ts.Programs slow; the sweep must never fail on time alone.
  test('every complete synthesized example transpiles and analyzes clean', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );
    const complete = page.widgets.filter((widget) => widget.example.complete);
    expect(complete.length).toBeGreaterThanOrEqual(349);

    await ensurePackageResolved(sweepPackageDir);
    await rm(probesDir, { recursive: true, force: true });
    await mkdir(probesDir, { recursive: true });
    for (const widget of complete) {
      const imports = exampleImports(widget.name, widget.example);
      const typeImport =
        imports.types.length === 0
          ? ''
          : `import type { ${imports.types.join(', ')} } from 'flutter-tsx';\n`;
      const source =
        `${typeImport}import { ${imports.values.join(', ')} } from 'flutter-tsx';\n\n` +
        `${exampleSource(widget.name, widget.example, { component: true })}\n`;
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
  }, 1800000);
});
