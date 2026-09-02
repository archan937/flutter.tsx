import { describe, expect, test } from 'bun:test';

import type { Recipe } from '@src/site/cookbook';
import { extractCoreApi } from '@src/site/core-api';

const HOOKS = new URL('../../src/runtime/hooks.ts', import.meta.url).pathname;
const SHELL = new URL('../../src/runtime/shell.ts', import.meta.url).pathname;

const recipe = (id: string, tsx: string): Recipe => ({
  id,
  title: id,
  blurb: '',
  category: 'Start here',
  tsx,
  dart: '',
  files: [],
});

const everything = (): Recipe[] => [
  recipe(
    '99-everything',
    [
      'useState useEffect useAsync useStream createStore useStore',
      'useNavigation createRouter json TabItem TabView Animated',
      'useAnimation tween',
    ].join(' '),
  ),
];

describe('extractCoreApi', () => {
  test('reads each hook with the signature its declaration resolves to', () => {
    const entries = extractCoreApi([HOOKS, SHELL], everything());

    expect(entries.find((entry) => entry.name === 'useState')).toEqual({
      name: 'useState',
      kind: 'hook',
      signature: '<TValue>(initial: TValue) => [TValue, StateSetter<TValue>]',
      doc: '',
      examples: ['99-everything'],
      usage: {
        id: '99-everything',
        title: '99-everything',
        label: '99-everything',
        blurb: '',
        tsx: everything()[0]?.tsx ?? '',
        dart: '',
      },
    });
  });

  test('names a shell element a component and a factory a function', () => {
    const entries = extractCoreApi([HOOKS, SHELL], everything());
    const kindOf = (name: string): string | undefined =>
      entries.find((entry) => entry.name === name)?.kind;

    expect(kindOf('TabView')).toBe('component');
    expect(kindOf('createStore')).toBe('function');
    expect(kindOf('Navigation')).toBe('type');
  });

  test('carries a type alias as the source declares it', () => {
    const entries = extractCoreApi([HOOKS, SHELL], everything());

    expect(entries.find((entry) => entry.name === 'RouteTarget')).toEqual({
      name: 'RouteTarget',
      kind: 'type',
      signature: 'export type RouteTarget = () => FlutterElement;',
      doc: 'A routable component takes no props: the router supplies nothing but the\nlocation, so a component needing props cannot be a route target — TypeScript\nrejects it rather than the Dart compiler.',
      examples: [],
      usage: null,
    });
  });

  test('refuses to document a value no fixture exercises', () => {
    // Documenting a hook the compiler is never shown to handle would be a
    // claim about the compiler, so the build fails instead.
    expect(() => extractCoreApi([HOOKS], [])).toThrow(
      'core API useState has no fixture using it.',
    );
  });

  test('shows the shortest fixture, so an entry reads as an example', () => {
    // Both fixtures exercise everything; only their length differs.
    const [all] = everything();
    const long = recipe('01-long', `${all?.tsx ?? ''} ${'x'.repeat(400)}`);
    const short = recipe('02-short', all?.tsx ?? '');

    const entries = extractCoreApi([HOOKS], [long, short]);

    // Every fixture is proof; the shortest is the one worth showing.
    expect(entries.find((entry) => entry.name === 'useState')?.usage?.id).toBe(
      '02-short',
    );
  });
});
