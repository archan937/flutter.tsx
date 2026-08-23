import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { formatTs } from '@src/generate/format';
import { buildSitePage } from '@src/site/from-snapshot';
import { emitExampleProbe } from '@src/site/probe';
import { buildApiReferenceHtml } from '@src/site/render';

const snapshot = await loadApiSnapshot();
const page = buildSitePage(snapshot, deriveSlots(snapshot));
const html = buildApiReferenceHtml(page);

const outputUrl = new URL('../../../docs/api-reference.html', import.meta.url);
await Bun.write(outputUrl, html);

const probeUrl = new URL(
  '../test/site/__generated__/examples.typecheck.tsx',
  import.meta.url,
);
await Bun.write(probeUrl, await formatTs(emitExampleProbe(page)));
process.stdout.write(
  `Wrote ${probeUrl.pathname} — ` +
    `${page.widgets.length - page.incompleteExamples.length} typechecked ` +
    `examples.\n`,
);

process.stdout.write(
  `Wrote ${outputUrl.pathname} — ${page.widgets.length} widgets, ` +
    `${page.enums.length} enums, Flutter ${page.flutterVersion} ` +
    `(${(html.length / 1024).toFixed(0)} KB).\n`,
);
if (page.incompleteExamples.length > 0) {
  process.stdout.write(
    `${page.incompleteExamples.length} widget example(s) carry a {…} ` +
      `placeholder for values that need prop transforms (step 15): ` +
      `${page.incompleteExamples.join(', ')}\n`,
  );
}
