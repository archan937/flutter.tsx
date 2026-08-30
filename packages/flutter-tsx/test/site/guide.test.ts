import { describe, expect, test } from 'bun:test';

import { loadRecipes } from '@src/site/cookbook';

const FIXTURES = new URL('../fixtures', import.meta.url).pathname;

// Every page that shows TSX. A snippet nobody compiles is a snippet that can
// rot, so each one must be a conformance fixture verbatim.
const DOCUMENTED = [
  '../../../../docs/guide.md',
  '../../../../README.md',
  '../../README.md',
] as const;

const GUIDE = new URL(DOCUMENTED[0], import.meta.url);

/** Every ```tsx block in the guide, trimmed the way a fixture file is. */
const tsxBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(/```tsx\n([\s\S]*?)```/g)].map((match) =>
    (match[1] ?? '').trimEnd(),
  );

describe('the guide', () => {
  test('every documented TSX snippet is a conformance fixture, verbatim', async () => {
    const recipes = await loadRecipes(FIXTURES);
    const sources = new Set(recipes.map((recipe) => recipe.tsx.trimEnd()));
    const strays: string[] = [];
    let documented = 0;

    for (const page of DOCUMENTED) {
      const blocks = tsxBlocks(
        await Bun.file(new URL(page, import.meta.url)).text(),
      );
      documented += blocks.length;
      strays.push(
        ...blocks
          .filter((block) => !sources.has(block))
          .map((block) => `${page}: ${block.split('\n')[0] ?? ''}`),
      );
    }

    expect(documented).toBeGreaterThan(0);
    expect(strays).toEqual([]);
  });

  test('documents the commands the CLI actually has', async () => {
    const markdown = await Bun.file(GUIDE).text();

    for (const command of [
      'fsx install',
      'fsx dev',
      'fsx build',
      'fsx doctor',
    ]) {
      expect(markdown).toContain(command);
    }
  });
});
