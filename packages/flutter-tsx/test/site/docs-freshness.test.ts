import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { loadTemplate, TEMPLATE_NAMES } from '@src/cli/templates';
import { deriveSlots } from '@src/derive/slots';
import { formatTs } from '@src/generate/format';
import {
  buildCookbookHtml,
  buildDocPageHtml,
  DOC_PAGES,
  loadRecipes,
  withShowcase,
  withTemplates,
  withVersion,
} from '@src/site/cookbook';
import { examplesMarkdown, summarizeExample } from '@src/site/examples';
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

  // The cards are written from the template registry. Hand-editing them would
  // let the page advertise an app that is not there, or miss one that is.
  test('the landing page shows exactly the templates that exist', async () => {
    const templates = await Promise.all(
      TEMPLATE_NAMES.map((name) => loadTemplate(name)),
    );
    const indexUrl = new URL('../../../../docs/index.html', import.meta.url);

    const committed = await Bun.file(indexUrl).text();

    expect(committed).toBe(
      withTemplates(committed, templates.map(summarizeExample)),
    );
    for (const name of TEMPLATE_NAMES) {
      expect([name, committed.includes(`./examples.html#${name}`)]).toEqual([
        name,
        true,
      ]);
    }
  }, 60000);

  // The page names the SDK it was built against; a bump that left the prose
  // behind would have it claiming a Flutter the compiler no longer targets.
  test('the landing page names the Flutter it was built against', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );
    const indexUrl = new URL('../../../../docs/index.html', import.meta.url);

    const committed = await Bun.file(indexUrl).text();

    expect(committed).toContain(`Flutter ${page.flutterVersion}`);
    expect(committed).toBe(withVersion(committed, page.flutterVersion));
  }, 60000);

  // The prose pages name the templates by hand, so a template added, renamed
  // or removed has to be reflected in both — or the command a reader copies
  // would not work.
  test('the guide and the README name every template, and only those', async () => {
    for (const source of [
      '../../../../docs/guide.md',
      '../../../../README.md',
    ]) {
      const text = await Bun.file(new URL(source, import.meta.url)).text();
      const named = [
        ...new Set(
          [...text.matchAll(/--template=([a-z<|>]+)/g)].map(
            (match) => match[1] ?? '',
          ),
        ),
      ]
        .filter((name) => !name.startsWith('<'))
        .sort();

      expect([source, named]).toEqual([source, [...TEMPLATE_NAMES].sort()]);
    }
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

  // The examples page is written from the template registry, so it lists the
  // apps `fsx init --template` actually writes. Editing it by hand would let
  // the page describe something that is not there.
  test('docs/examples.md is written from the templates themselves', async () => {
    const templates = await Promise.all(
      TEMPLATE_NAMES.map((name) => loadTemplate(name)),
    );
    const committed = await Bun.file(
      new URL('../../../../docs/examples.md', import.meta.url),
    ).text();

    expect(committed).toBe(examplesMarkdown(templates));
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
