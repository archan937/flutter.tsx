import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { CATALOGUE, CATEGORIES } from '@src/site/catalogue';
import {
  buildCookbookHtml,
  loadRecipes,
  type Recipe,
  showcaseFiles,
  SHOWCASES,
  withShowcase,
} from '@src/site/cookbook';
import type { SitePage } from '@src/site/model';
import { page as samplePage } from '@test/support/sample-page';

const FIXTURES_DIR = new URL('../fixtures', import.meta.url).pathname;

const counter: Recipe = {
  id: '05-counter',
  title: 'State with useState',
  blurb: 'The hook you already know.',
  category: 'Start here',
  tsx: 'export const Counter = () => <Text>0</Text>;\n',
  dart: "import 'package:flutter/material.dart';\n",
  files: [
    {
      tsxName: 'src/Counter.tsx',
      tsx: 'export const Counter = () => <Text>0</Text>;\n',
      dartName: 'counter.dart',
      dart: "import 'package:flutter/material.dart';\n",
    },
  ],
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

  test('titles and explains a fixture from the catalogue', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);
    const found = recipes.find((recipe) => recipe.id === '05-counter');

    // A directory name is not a title a newcomer can read.
    expect(found?.title).toBe(CATALOGUE['05-counter']?.title);
    expect(found?.blurb).toBe(CATALOGUE['05-counter']?.blurb);
    expect(found?.category).toBe('Start here');
  });

  test('carries every file an example is made of', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);
    const multi = recipes.find((recipe) => recipe.id === '28-multi-file');

    // The point of this example is the second file; showing one of them
    // left the reader with a component that appears from nowhere.
    expect(multi?.files.map((file) => file.tsxName)).toEqual([
      'src/Directory.tsx',
      'src/UserCard.tsx',
    ]);
    expect(multi?.files.map((file) => file.dartName)).toEqual([
      'directory.dart',
      'user_card.dart',
    ]);
    expect(multi?.files[1]?.tsx).toContain('export const UserCard');
    expect(multi?.files[1]?.dart).toContain('class UserCard');
  });

  test('describes every fixture, in a category it renders', async () => {
    const recipes = await loadRecipes(FIXTURES_DIR);

    for (const recipe of recipes) {
      expect(recipe.blurb.length).toBeGreaterThan(20);
      expect(CATEGORIES).toContain(recipe.category);
    }
    // And nothing is catalogued that no longer exists.
    const ids = new Set(recipes.map((recipe) => recipe.id));
    expect(Object.keys(CATALOGUE).filter((id) => !ids.has(id))).toEqual([]);
  });

  test('refuses a fixture nobody wrote a catalogue entry for', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-cookbook-'));
    await mkdir(join(dir, '99-unknown'), { recursive: true });
    await Bun.write(
      join(dir, '99-unknown', 'input.tsx'),
      'export const A = 1;',
    );
    await Bun.write(join(dir, '99-unknown', 'expected.dart'), 'class A {}');

    // A new fixture must be described before it can reach a reader.
    expect(loadRecipes(dir)).rejects.toThrow(
      'fixture 99-unknown has no catalogue entry — a reader would get two ' +
        'unexplained code blocks.',
    );

    await rm(dir, { recursive: true, force: true });
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

    expect(html).toContain(
      '<section class="recipe" id="05-counter" data-name="State with useState">',
    );
    expect(html).toContain('<p class="blurb">The hook you already know.</p>');
    // One tabbed pane per recipe, a tab per file — never two columns.
    expect(html).toContain('data-tab="src/Counter.tsx"');
    expect(html).toContain('data-panel="counter.dart"');
    expect(html).not.toContain('class="pair"');
    expect(html).toContain('Flutter 3.47.1');
  });

  test('groups recipes under the category they belong to', () => {
    const html = buildCookbookHtml(recipes, '3.47.1');

    expect(html).toContain('<h2 id="start-here">Start here</h2>');
    // A category nothing falls into is not rendered as an empty heading.
    expect(html).not.toContain('Project structure');
  });

  test('offers a sidebar that reaches every recipe', () => {
    const html = buildCookbookHtml(recipes, '3.47.1');

    // The same sidebar the API reference has: search, groups, scroll-spy.
    expect(html).toContain('<aside id="sidebar">');
    expect(html).toContain('<input id="search"');
    expect(html).toContain(
      '<li data-name="State with useState"><a href="#05-counter">State with useState</a></li>',
    );
  });

  test('escapes markup so a fixture cannot inject any', () => {
    const injected = '<script>alert(1)</script>';
    const html = buildCookbookHtml(
      [
        {
          ...counter,
          files: counter.files.map((file) => ({ ...file, tsx: injected })),
        },
      ],
      '3.47.1',
    );

    expect(html).not.toContain(injected);
    expect(html).toContain('&lt;script&gt;alert(');
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

  // Only the counts and the version are read from the page model.
  const model: SitePage = { ...samplePage, flutterVersion: '3.47.1' };

  test('offers every showcase, so one example does not stand for the whole compiler', async () => {
    const html = withShowcase(page, await load(), model);

    for (const showcase of SHOWCASES) {
      expect(html).toContain(`data-example="${showcase.id}"`);
      expect(html).toContain(`>${showcase.label}</button>`);
    }
    expect(html).not.toContain('>old<');
  }, 60000);

  test('renders both panels for every showcase, only the first one open', async () => {
    const html = withShowcase(page, await load(), model);

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
    const html = withShowcase(page, await load(), model);

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
    const html = withShowcase(page, await load(), model);

    expect(html).toContain('TSX in · Dart out · Flutter 3.47.1');
    expect(html).toContain('idiomatic Dart · Flutter 3.47.1');
    expect(html).not.toContain('3.44.0');
  }, 60000);

  test('refuses to render a showcase whose fixture is gone', () => {
    expect(() => withShowcase(page, [counter], model)).toThrow(
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
