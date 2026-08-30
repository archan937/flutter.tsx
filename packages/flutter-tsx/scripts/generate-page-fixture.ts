import { buildApiReferenceHtml } from '@src/site/render';
import { page } from '@test/support/sample-page';

// The renderer's golden page: a small, hand-built model rendered in full, so
// any change to the page shell or a section shows up as a reviewable diff.
const outUrl = new URL(
  '../test/site/__fixtures__/api-reference-page.html',
  import.meta.url,
);
await Bun.write(outUrl, buildApiReferenceHtml(page));
process.stdout.write(`Wrote ${outUrl.pathname}\n`);
