import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { formatTs } from '@src/generate/format';
import {
  buildCookbookHtml,
  buildDocPageHtml,
  DOC_PAGES,
  loadRecipes,
  withShowcase,
} from '@src/site/cookbook';
import { buildSitePage } from '@src/site/from-snapshot';
import { renderMarkdown } from '@src/site/markdown';
import { emitExampleProbe } from '@src/site/probe';
import { buildApiReferenceHtml } from '@src/site/render';
import { loadSiteSections } from '@src/site/sections';

const snapshot = await loadApiSnapshot();
const page = buildSitePage(
  snapshot,
  deriveSlots(snapshot),
  await loadSiteSections(),
);
const html = buildApiReferenceHtml(page);

const outputUrl = new URL('../../../docs/api-reference.html', import.meta.url);
await Bun.write(outputUrl, html);

// The cookbook is the fixtures themselves: what a developer writes beside
// what the compiler emits, with nothing written by hand in between.
const recipes = await loadRecipes(
  new URL('../test/fixtures', import.meta.url).pathname,
);
const cookbookUrl = new URL('../../../docs/cookbook.html', import.meta.url);
await Bun.write(cookbookUrl, buildCookbookHtml(recipes, page.flutterVersion));
process.stdout.write(
  `Wrote ${cookbookUrl.pathname} — ${recipes.length} recipes from fixtures.\n`,
);

// The landing page shows one of those pairs; keep it the fixture's own.
const indexUrl = new URL('../../../docs/index.html', import.meta.url);
const indexHtml = await Bun.file(indexUrl).text();
await Bun.write(
  indexUrl,
  withShowcase(indexHtml, recipes, page.flutterVersion),
);
process.stdout.write(`Wrote ${indexUrl.pathname} — showcase from fixtures.\n`);

// The prose pages are markdown in the repository — where GitHub renders them —
// and HTML on the site, from that same source.
for (const docPage of DOC_PAGES) {
  const markdown = await Bun.file(
    new URL(`../../../docs/${docPage.source}`, import.meta.url),
  ).text();
  const pageUrl = new URL(
    `../../../docs/${docPage.source.replace(/\.md$/, '.html')}`,
    import.meta.url,
  );
  await Bun.write(pageUrl, buildDocPageHtml(docPage, renderMarkdown(markdown)));
  process.stdout.write(`Wrote ${pageUrl.pathname}\n`);
}

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
  `Wrote ${outputUrl.pathname} — ${page.coreApi.length} core APIs, ` +
    `${page.widgets.length} widgets, ${page.plugins.length} plugins, ` +
    `${page.types.length} types, ${page.enums.length} enums, ` +
    `Flutter ${page.flutterVersion} ` +
    `(${(html.length / 1024).toFixed(0)} KB).\n`,
);
if (page.incompleteExamples.length > 0) {
  process.stdout.write(
    `${page.incompleteExamples.length} widget example(s) carry a {…} ` +
      `placeholder for value kinds later roadmap steps make expressible ` +
      `(callbacks with bodies, controllers, animations): ` +
      `${page.incompleteExamples.join(', ')}\n`,
  );
}
