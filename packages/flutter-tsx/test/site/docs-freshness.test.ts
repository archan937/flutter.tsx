import { describe, expect, test } from 'bun:test';

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
import { withRequirementsTable } from '@src/site/requirements-table';
import { loadSiteSections } from '@src/site/sections';

describe('committed generated docs', () => {
  test('docs/api-reference.html and the example probe are byte-identical to a fresh render', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );

    const committedHtml = await Bun.file(
      new URL('../../../../docs/api-reference.html', import.meta.url),
    ).text();
    expect(committedHtml).toBe(buildApiReferenceHtml(page));

    const committedProbe = await Bun.file(
      new URL('__generated__/examples.typecheck.tsx', import.meta.url),
    ).text();
    expect(committedProbe).toBe(await formatTs(emitExampleProbe(page)));
  }, 60000);

  test('docs/cookbook.html is byte-identical to a fresh render of the fixtures', async () => {
    const recipes = await loadRecipes(
      new URL('../fixtures', import.meta.url).pathname,
    );
    const snapshot = await loadApiSnapshot();

    const committed = await Bun.file(
      new URL('../../../../docs/cookbook.html', import.meta.url),
    ).text();

    expect(committed).toBe(
      buildCookbookHtml(recipes, snapshot.meta.frameworkVersion),
    );
  }, 60000);

  test('the landing page showcase is the fixture it claims to show', async () => {
    const recipes = await loadRecipes(
      new URL('../fixtures', import.meta.url).pathname,
    );
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );
    const indexUrl = new URL('../../../../docs/index.html', import.meta.url);

    const committed = await Bun.file(indexUrl).text();

    expect(committed).toBe(withShowcase(committed, recipes, page));
  }, 60000);

  test('the committed markdown carries the derived requirements table', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );
    const sourceUrl = new URL(
      '../../../../docs/config-mapping.md',
      import.meta.url,
    );

    const committed = await Bun.file(sourceUrl).text();

    // The table was hand-written and listed capabilities nothing extracts.
    expect(committed).toBe(withRequirementsTable(committed, page.plugins));
    expect(committed).toContain('`NSCameraUsageDescription`');
  }, 60000);

  test('each prose page is a fresh render of its markdown source', async () => {
    for (const page of DOC_PAGES) {
      const markdown = await Bun.file(
        new URL(`../../../../docs/${page.source}`, import.meta.url),
      ).text();
      const committed = await Bun.file(
        new URL(
          `../../../../docs/${page.source.replace(/\.md$/, '.html')}`,
          import.meta.url,
        ),
      ).text();

      expect(committed).toBe(buildDocPageHtml(page, renderMarkdown(markdown)));
    }
  }, 60000);
});
