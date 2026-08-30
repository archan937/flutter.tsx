import { describe, expect, test } from 'bun:test';

import {
  buildCookbookHtml,
  loadRecipes,
  type Recipe,
  showcaseFiles,
  SHOWCASES,
  withShowcase,
} from '@src/site/cookbook';

const FIXTURES_DIR = new URL('../fixtures', import.meta.url).pathname;

const counter: Recipe = {
  id: '05-counter',
  title: 'Counter',
  tsx: 'export const Counter = () => <Text>0</Text>;\n',
  dart: "import 'package:flutter/material.dart';\n",
};

describe('loadRecipes', () => {
  test('reads every certified fixture as a TSX and Dart pair', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);

    // Every recipe is a fixture the golden suite proves byte-for-byte.
    expect(recipes.length).toBeGreaterThan(30);
    for (const recipe of recipes) {
      expect(recipe.tsx.length).toBeGreaterThan(0);
      // Plugin fixtures import their own package first, and one starts with
      // dart:convert; every emitted file starts with some import.
      expect(recipe.dart.startsWith("import '")).toBe(true);
    }
  });

  test('titles a fixture from its directory name', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);
    const counter = recipes.find((recipe) => recipe.id === '05-counter');

    expect(counter?.title).toBe('Counter');
  });

  test('orders recipes the way the fixtures are numbered', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);

    expect(recipes.map((recipe) => recipe.id)).toEqual(
      [...recipes.map((recipe) => recipe.id)].sort(),
    );
  });
});

describe('buildCookbookHtml', () => {
  const recipes: Recipe[] = [counter];

  test('renders every recipe as the TSX written and the Dart emitted', () => {
    const html = buildCookbookHtml(recipes, '3.47.1');

    expect(html).toContain('<h2 id="05-counter">Counter</h2>');
    expect(html).toContain('export const Counter = () =&gt; &lt;Text&gt;');
    expect(html).toContain("import 'package:flutter/material.dart';");
    expect(html).toContain('Flutter 3.47.1');
  });

  test('escapes markup so a fixture cannot inject any', () => {
    const html = buildCookbookHtml(
      [{ ...counter, tsx: '<script>alert(1)</script>' }],
      '3.47.1',
    );

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('lists every recipe in its contents', () => {
    const html = buildCookbookHtml(recipes, '3.47.1');

    expect(html).toContain('<a href="#05-counter">Counter</a>');
  });
});

describe('withShowcase', () => {
  const page = [
    '<span class="eyebrow">TSX in · Dart out · Flutter 3.44.0</span>',
    '<span id="compile-name">Old.tsx</span>',
    '<span>idiomatic Dart · Flutter 3.44.0</span>',
    '<span class="fname" id="fname">src/Old.tsx</span>',
    '<!-- showcase:picker --><div id="picker"></div><!-- /showcase:picker -->',
    '<!-- showcase:panels -->old<!-- /showcase:panels -->',
    "const EXAMPLES = { '00-old': { tsx: 'src/Old.tsx', dart: 'old.dart' } };",
  ].join('\n');

  const load = async (): Promise<Recipe[]> => loadRecipes(FIXTURES_DIR);

  test('offers every showcase, so one example does not stand for the whole compiler', async () => {
    const html = withShowcase(page, await load(), '3.47.1');

    for (const showcase of SHOWCASES) {
      expect(html).toContain(`data-example="${showcase.id}"`);
      expect(html).toContain(`>${showcase.label}</button>`);
    }
    expect(html).not.toContain('>old<');
  }, 60000);

  test('renders both panels for every showcase, only the first one open', async () => {
    const html = withShowcase(page, await load(), '3.47.1');

    for (const showcase of SHOWCASES) {
      expect(html).toContain(`data-example="${showcase.id}" data-panel="tsx"`);
      expect(html).toContain(`data-example="${showcase.id}" data-panel="dart"`);
    }
    // Exactly one panel is open, and it is the first showcase's TSX.
    expect(html.match(/class="tab-panel active"/g)?.length).toBe(1);
    expect(html).toContain(
      `<div class="tab-panel active" data-example="${SHOWCASES[0].id}" data-panel="tsx">`,
    );
  }, 60000);

  test('names the files the compiler reads and writes', async () => {
    const html = withShowcase(page, await load(), '3.47.1');

    // `05-counter` exports Counter, so a project would hold these two files.
    expect(html).toContain(
      '<span class="fname" id="fname">src/Counter.tsx</span>',
    );
    expect(html).toContain('<span id="compile-name">Counter.tsx</span>');
    expect(html).toContain(
      "'05-counter': { tsx: 'src/Counter.tsx', dart: 'counter.dart' },",
    );
    // A file exporting several components is named after its last one.
    expect(html).toContain(
      "'23-tabs': { tsx: 'src/Shell.tsx', dart: 'shell.dart' },",
    );
    expect(html).not.toContain('Old');
  }, 60000);

  test('states the Flutter version the page was generated against', async () => {
    const html = withShowcase(page, await load(), '3.47.1');

    expect(html).toContain('TSX in · Dart out · Flutter 3.47.1');
    expect(html).toContain('idiomatic Dart · Flutter 3.47.1');
    expect(html).not.toContain('3.44.0');
  }, 60000);

  test('refuses to render a showcase whose fixture is gone', () => {
    expect(() => withShowcase(page, [counter], '3.47.1')).toThrow(
      'the showcase fixture 01-camera-screen is missing.',
    );
  });
});

describe('showcaseFiles', () => {
  test('refuses a fixture that exports no component', () => {
    expect(() => showcaseFiles({ ...counter, tsx: 'const x = 1;\n' })).toThrow(
      'the showcase fixture 05-counter exports no component.',
    );
  });
});
