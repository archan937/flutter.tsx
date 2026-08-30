import { describe, expect, test } from 'bun:test';

import { loadRecipes } from '@src/site/cookbook';
import { examplesFrom, loadSiteSections } from '@src/site/sections';

describe('examplesFrom', () => {
  test('refuses to lead the reference with a fixture the suite lost', () => {
    expect(() => examplesFrom([])).toThrow(
      'the showcase fixture 05-counter is missing.',
    );
  });

  test('carries each fixture pair verbatim, under its capability', async () => {
    const recipes = await loadRecipes(
      new URL('../fixtures', import.meta.url).pathname,
    );

    const examples = examplesFrom(recipes);
    const counter = recipes.find((each) => each.id === '05-counter');

    expect(examples[0]).toEqual({
      id: '05-counter',
      title: 'Counter',
      label: 'State',
      tsx: counter?.tsx ?? '',
      dart: counter?.dart ?? '',
    });
  }, 60000);

  test('leads with a spread of capabilities, not one repeated', async () => {
    const recipes = await loadRecipes(
      new URL('../fixtures', import.meta.url).pathname,
    );

    expect(examplesFrom(recipes).map((each) => each.label)).toEqual([
      'State',
      'Camera',
      'Lists',
      'Async data',
      'Store',
      'Router',
      'Tabs',
      'Animation',
    ]);
  }, 60000);
});

describe('loadSiteSections', () => {
  test('assembles every documented plugin from the reference set', async () => {
    const sections = await loadSiteSections();

    expect(sections.plugins.map((plugin) => plugin.package)).toEqual([
      'camera',
      'connectivity_plus',
      'flutter_secure_storage',
      'http',
      'package_info_plus',
      'shared_preferences',
      'url_launcher',
    ]);
    expect(sections.examples.map((each) => each.id)).toContain(
      '01-camera-screen',
    );
    expect(sections.coreApi.length).toBeGreaterThan(0);
    expect(sections.generatedFiles.length).toBeGreaterThan(0);
  }, 60000);
});
