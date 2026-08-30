import { describe, expect, test } from 'bun:test';

import {
  buildCookbookHtml,
  loadRecipes,
  type Recipe,
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
  const camera: Recipe = {
    id: '01-camera-screen',
    title: 'Camera Screen',
    tsx:
      "import { useCamera } from 'plugin:camera';\n\n" +
      'export const CameraScreen = () => <Text>Take Photo</Text>;\n',
    dart: "import 'package:camera/camera.dart';\n",
  };
  const page = [
    '<span class="eyebrow"><span class="dot"></span> TSX in · Dart out · Flutter 3.44.0</span>',
    '<div class="compile-bar">',
    '  <span>Old.tsx</span>',
    '  <span class="arrow">⟶</span>',
    '  <span>idiomatic Dart · Flutter 3.44.0</span>',
    '</div>',
    '<span class="fname" id="fname">src/Old.tsx</span>',
    '<!-- showcase:tsx -->old<!-- /showcase:tsx -->',
    '<!-- showcase:dart -->old<!-- /showcase:dart -->',
    "const names = { tsx: 'src/Old.tsx', dart: 'Old.g.dart' };",
  ].join('\n');

  test('replaces both panels with the fixture they claim to show', () => {
    const html = withShowcase(page, [camera], '3.47.1');

    expect(html).toContain(
      "<pre>import { useCamera } from 'plugin:camera';\n\n" +
        'export const CameraScreen = () =&gt; &lt;Text&gt;Take Photo&lt;/Text&gt;;</pre>',
    );
    expect(html).toContain("<pre>import 'package:camera/camera.dart';</pre>");
    expect(html).not.toContain('>old<');
  });

  test('names the files the compiler reads and writes', () => {
    const html = withShowcase(page, [camera], '3.47.1');

    expect(html).toContain(
      '<span class="fname" id="fname">src/CameraScreen.tsx</span>',
    );
    expect(html).toContain('<span>CameraScreen.tsx</span>');
    // The emitted file is snake_case — not the `.g.dart` this page claimed.
    expect(html).toContain(
      "const names = { tsx: 'src/CameraScreen.tsx', dart: 'camera_screen.dart' };",
    );
    expect(html).not.toContain('Old');
  });

  test('states the Flutter version the page was generated against', () => {
    const html = withShowcase(page, [camera], '3.47.1');

    expect(html).toContain('TSX in · Dart out · Flutter 3.47.1');
    expect(html).toContain('idiomatic Dart · Flutter 3.47.1');
    expect(html).not.toContain('3.44.0');
  });

  test('refuses to render a showcase whose fixture is gone', () => {
    expect(() => withShowcase(page, [counter], '3.47.1')).toThrow(
      'the showcase fixture 01-camera-screen is missing.',
    );
  });

  test('refuses a showcase fixture that exports no component', () => {
    expect(() =>
      withShowcase(page, [{ ...camera, tsx: 'const x = 1;\n' }], '3.47.1'),
    ).toThrow('the showcase fixture 01-camera-screen exports no component.');
  });
});
