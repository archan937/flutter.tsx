import { describe, expect, test } from 'bun:test';

import { SHOWCASES } from '@src/site/cookbook';

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
});
