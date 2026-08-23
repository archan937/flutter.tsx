import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { buildApiReferenceHtml } from '@src/site/render';

const snapshot = await loadApiSnapshot();
const page = buildSitePage(snapshot, deriveSlots(snapshot));
const html = buildApiReferenceHtml(page);

const outputUrl = new URL('../../../docs/api-reference.html', import.meta.url);
await Bun.write(outputUrl, html);

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
