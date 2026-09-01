import { readdir } from 'node:fs/promises';

import { describe, expect, test } from 'bun:test';

import type { TypeNode } from '@src/api/model';
import { loadPluginApi, type PluginApi } from '@src/plugins/api';
import { emitPluginDeclaration } from '@src/plugins/emit-types';
import { deriveHooks } from '@src/plugins/hooks';
import { PLUGIN_OVERRIDES } from '@src/plugins/overrides';
import { classReach, type Reach } from '@src/plugins/reachability';

const extractedPlugins = (
  await readdir(new URL('../../ref/plugins/', import.meta.url).pathname)
)
  .filter((entry) => entry.endsWith('.json'))
  .map((entry) => entry.replace(/\.json$/, ''))
  .sort();

/** Classes a developer can hold a value of, and so may see declared. */
const USABLE: readonly Reach[] = [
  'hook',
  'listener',
  'widget',
  'value',
  'constructed',
];

const declaredClasses = (declaration: string): string[] =>
  [...declaration.matchAll(/export (?:class|const) (\w+)(?::| \{|\{)/g)].map(
    (match) => match[1] ?? '',
  );

/**
 * The anti-facade gate.
 *
 * Extracting a class the developer cannot reach — and then declaring it in
 * the typings and listing it in the API reference — is the exact shape of a
 * facade this project refuses. Every class of every extracted package is
 * accounted for by a route that really compiles, and the typings advertise
 * those and nothing else.
 */
describe('every extracted class is reachable from TSX', () => {
  for (const packageName of extractedPlugins) {
    test(`${packageName} declares what is usable, and only that`, async () => {
      const api: PluginApi = await loadPluginApi(packageName);
      const reach = classReach(api, PLUGIN_OVERRIDES);
      const declaration = emitPluginDeclaration(
        api,
        deriveHooks(api, PLUGIN_OVERRIDES[packageName]),
      );
      const declared = new Set(declaredClasses(declaration));

      // A platform's own implementation is registered by Flutter; offering it
      // in autocomplete is offering something that does nothing.
      expect(
        reach
          .filter((entry) => entry.reach === 'internal')
          .filter((entry) => declared.has(entry.name))
          .map((entry) => entry.name),
      ).toEqual([]);

      // Everything a developer can hold is declared, or the value they were
      // handed would have no type to be.
      expect(
        reach
          .filter((entry) => USABLE.includes(entry.reach))
          .filter((entry) => !declared.has(entry.name))
          .map((entry) => entry.name),
      ).toEqual([]);
    });
  }

  test('a type reaches what is nested inside it, however it is wrapped', () => {
    // A class named only inside a map, a callback's parameter or a set is
    // still handed to the developer, so it counts as reached.
    const named = (name: string): TypeNode => ({ kind: 'named', name });
    const entity = (name: string): PluginApi['classes'][number] => ({
      name,
      doc: '',
      supertypes: [],
      constructors: [],
      fields: [],
      methods: [],
      constants: [],
    });
    const api: PluginApi = {
      package: 'demo',
      version: '1.0.0',
      permissions: {
        android: {
          manifestSource: null,
          permissions: [],
          exampleSource: null,
          querySchemes: [],
        },
        ios: {
          exampleSource: null,
          usageDescriptionKeys: [],
          querySchemes: [],
        },
      },
      instances: [],
      enums: [],
      classes: [entity('InMap'), entity('InCallback'), entity('InSet')],
      functions: [
        {
          name: 'run',
          doc: '',
          isStatic: false,
          returnType: {
            kind: 'map',
            key: { kind: 'scalar', name: 'String' },
            value: named('InMap'),
          },
          params: [
            {
              name: 'onEach',
              type: {
                kind: 'function',
                returnType: { kind: 'set', item: named('InSet') },
                params: [
                  {
                    name: 'item',
                    type: named('InCallback'),
                    named: false,
                    required: true,
                  },
                ],
              },
              display: '',
              named: false,
              required: true,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ],
    };

    expect(classReach(api).map((entry) => [entry.name, entry.reach])).toEqual([
      ['InMap', 'value'],
      ['InCallback', 'value'],
      ['InSet', 'value'],
    ]);
  });

  test('every route is one the compiler really has', async () => {
    const routes = new Set<Reach | null>();
    for (const packageName of extractedPlugins) {
      const api = await loadPluginApi(packageName);
      for (const entry of classReach(api, PLUGIN_OVERRIDES)) {
        routes.add(entry.reach);
      }
    }

    // Each of these is exercised by a conformance fixture or a template:
    // hooks and listeners by the plugin fixtures, widgets by 46, values by
    // 45, construction by the url_launcher options in the tray template, and
    // `internal` by the federated packages that ship a platform class.
    expect([...routes].sort()).toEqual([
      'base',
      'constructed',
      'hook',
      'internal',
      'listener',
      'value',
      'widget',
    ]);
  });
});
