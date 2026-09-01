import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { SHOWCASES } from '@src/site/cookbook';
import { buildSitePage } from '@src/site/from-snapshot';
import { loadSiteSections } from '@src/site/sections';

const landingPage = async (): Promise<string> =>
  Bun.file(new URL('../../../../docs/index.html', import.meta.url)).text();

const matches = (html: string, pattern: RegExp): string[] =>
  [...html.matchAll(pattern)].map((match) => match[1] ?? '');

/**
 * The showcase is generated, but the script that drives it is written by hand
 * in the page. These are the invariants that script depends on: break one and
 * the picker silently shows nothing, which no other gate would notice.
 */
describe('the landing page showcase', () => {
  test('has every element the switcher looks up', async () => {
    const html = await landingPage();

    for (const id of ['toggle', 'picker', 'fname', 'compile-name']) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  test('opens exactly one panel, the first showcase in TSX', async () => {
    const html = await landingPage();

    expect(html.match(/class="tab-panel active"/g)?.length).toBe(1);
    expect(html).toContain(
      `<div class="tab-panel active" data-example="${SHOWCASES[0].id}" data-panel="tsx">`,
    );
  });

  test('can drive every panel: a button, both panels and a name each', async () => {
    const html = await landingPage();

    const buttons = matches(html, /<button[^>]*data-example="([^"]+)"/g);
    const named = matches(html, /^\s*'([^']+)': \{ tsx:/gm);
    expect(buttons).toEqual(SHOWCASES.map((showcase) => showcase.id));
    expect(named).toEqual(SHOWCASES.map((showcase) => showcase.id));

    for (const showcase of SHOWCASES) {
      for (const panel of ['tsx', 'dart']) {
        expect(html).toContain(
          `data-example="${showcase.id}" data-panel="${panel}"`,
        );
      }
    }
  });

  test('counts what the reference documents, not what a past release had', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(
      snapshot,
      deriveSlots(snapshot),
      await loadSiteSections(),
    );
    const html = await landingPage();

    // These were typed by hand and carried the previous engine's figures:
    // 542 widgets, 38 plugins, 12 hooks, 147 enums, 770 types.
    expect(matches(html, /data-count="(\d+)"/g)).toEqual([
      String(page.widgets.length),
      String(page.plugins.length),
      String(page.coreApi.length),
      String(page.enums.length),
      String(page.types.length),
    ]);
    expect(html).toContain(`every one of the ${page.widgets.length}`);
  }, 60000);

  test('points at the repository it is published from', async () => {
    const html = await landingPage();

    // `archan937/flutter-tsx` is the previous engine's repository.
    expect(html).not.toContain('archan937/flutter-tsx');
    expect(html).toContain('archan937/flutter.tsx');
  });

  test('offers a command that works today', async () => {
    const html = await landingPage();

    // `npm create flutter-tsx@latest` installs 0.3.3 — the previous engine —
    // until 1.0 publishes, so the hero cannot hand it to a newcomer.
    expect(html).not.toContain('data-cmd="npm create flutter-tsx@latest"');
    expect(html).toContain(
      'data-cmd="git clone https://github.com/archan937/flutter.tsx"',
    );
  });
});

const PAGES = [
  'index.html',
  'guide.html',
  'cookbook.html',
  'examples.html',
  'api-reference.html',
  'config-mapping.html',
];

const docPage = async (name: string): Promise<string> =>
  Bun.file(new URL(`../../../../docs/${name}`, import.meta.url)).text();

/**
 * The main navigation is the one thing every page shares. The API reference
 * once listed none of its siblings, so the largest page on the site was a
 * dead end; each of the others listed a different subset.
 */
describe('the main navigation', () => {
  test('reaches every other page, from every page', async () => {
    for (const name of PAGES) {
      const html = await docPage(name);
      const reached = new Set(
        [...html.matchAll(/href="\.\/([a-z-]+\.html)"/g)].map(
          (match) => match[1] ?? '',
        ),
      );
      const expected = PAGES.filter((other) => other !== name);
      expect([name, [...reached].sort()]).toEqual([name, expected.sort()]);
    }
  }, 60000);

  test('marks the page the reader is on, on every generated page', async () => {
    for (const name of PAGES.filter((page) => page !== 'index.html')) {
      const html = await docPage(name);
      expect([name, html.includes('aria-current="page"')]).toEqual([
        name,
        true,
      ]);
    }
  }, 60000);
});
