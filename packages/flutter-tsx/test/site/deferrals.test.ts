import { describe, expect, test } from 'bun:test';

import {
  completedSteps,
  extractDeferrals,
  staleDeferrals,
} from '@src/site/deferrals';

const COMPILER = ['analyze', 'lower', 'translate', 'strict-mode', 'transpile'];

const compilerSources = async (): Promise<{ path: string; text: string }[]> =>
  Promise.all(
    COMPILER.map(async (name) => ({
      path: `src/compiler/${name}.ts`,
      text: await Bun.file(
        new URL(`../../src/compiler/${name}.ts`, import.meta.url),
      ).text(),
    })),
  );

describe('extractDeferrals', () => {
  test('reads a limitation out of the raise that states it', () => {
    const found = extractDeferrals([
      {
        path: 'x.ts',
        text:
          "throw tsxErrorAt(\n'TSX0305',\n`\\`${name}\\` reads a member the " +
          "compiler cannot resolve ` +\n'to a Dart one.',\n{ node },\n);",
      },
    ]);

    expect(found).toEqual([
      {
        code: 'TSX0305',
        message:
          '`…` reads a member the compiler cannot resolve to a Dart one.',
        source: 'x.ts',
      },
    ]);
  });

  test('ignores a rejection of code that is simply wrong', () => {
    const found = extractDeferrals([
      {
        path: 'x.ts',
        text: "throw tsxErrorAt('TSX0205', 'a hex color needs 3, 6 or 8 digits.', {",
      },
    ]);

    expect(found).toEqual([]);
  });
});

describe('completedSteps', () => {
  test('reads the roadmap items that are checked off', () => {
    expect([
      ...completedSteps('- [x] 18. useEffect\n- [ ] 31. publish\n'),
    ]).toEqual(['18']);
  });
});

describe('no limitation promises a step that already shipped', () => {
  test('every deferral the compiler raises is honest about its timing', async () => {
    const roadmap = await Bun.file(
      new URL('../../../../CLAUDE.md', import.meta.url),
    ).text();

    const stale = staleDeferrals(
      extractDeferrals(await compilerSources()),
      completedSteps(roadmap),
    );

    // TSX0305 said "roadmap step 18" and TSX0307 "roadmap step 22" long after
    // both shipped, which is how a developer ends up waiting for nothing.
    expect(stale).toEqual([]);
  }, 60000);

  test('the compiler still declares the limitations it has', async () => {
    const found = extractDeferrals(await compilerSources());

    // A drop to zero means the sweep stopped matching, not that the compiler
    // became total — that would be a silently disabled gate.
    expect(found.length).toBeGreaterThan(3);
  }, 60000);
});
