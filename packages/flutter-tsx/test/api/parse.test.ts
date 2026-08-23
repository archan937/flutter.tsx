import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot } from '@src/api/model';
import { parseApiSnapshot } from '@src/api/parse';

const meta = {
  frameworkVersion: '3.47.1',
  dartSdkVersion: '3.13.1',
  frameworkRevision: 'abc123',
};

const widgetEntity = {
  kind: 'widget',
  name: 'Center',
  library: 'widgets',
  doc: '/// Centers.',
  supertypes: ['Align', 'Widget'],
  constructors: [
    {
      name: '',
      doc: '/// Creates.',
      params: [
        {
          name: 'child',
          type: { kind: 'nullable', inner: { kind: 'widget' } },
          display: 'Widget?',
          named: true,
          required: false,
          defaultValue: null,
          doc: '/// The child.',
          deprecated: false,
        },
      ],
    },
  ],
  constants: [
    {
      name: 'zero',
      type: { kind: 'scalar', name: 'int' },
      display: 'int',
      doc: '/// Zero.',
    },
  ],
};

const enumEntity = {
  kind: 'enum',
  name: 'Axis',
  library: 'painting',
  doc: '/// Axes.',
  values: [{ name: 'horizontal', doc: '/// Sideways.' }],
};

const document = { meta, entities: [widgetEntity, enumEntity] };

const withEntity = (entity: object): object => ({
  meta,
  entities: [entity],
});

describe('parseApiSnapshot', () => {
  test('parses a complete document into the exact typed model', () => {
    const expected: ApiSnapshot = {
      meta,
      entities: [
        {
          kind: 'widget',
          name: 'Center',
          library: 'widgets',
          doc: '/// Centers.',
          supertypes: ['Align', 'Widget'],
          constructors: [
            {
              name: '',
              doc: '/// Creates.',
              params: [
                {
                  name: 'child',
                  type: { kind: 'nullable', inner: { kind: 'widget' } },
                  display: 'Widget?',
                  named: true,
                  required: false,
                  defaultValue: null,
                  doc: '/// The child.',
                  deprecated: false,
                },
              ],
            },
          ],
          constants: [
            {
              name: 'zero',
              type: { kind: 'scalar', name: 'int' },
              display: 'int',
              doc: '/// Zero.',
            },
          ],
        },
        {
          kind: 'enum',
          name: 'Axis',
          library: 'painting',
          doc: '/// Axes.',
          values: [{ name: 'horizontal', doc: '/// Sideways.' }],
        },
      ],
    };

    expect(parseApiSnapshot(document)).toEqual(expected);
  });

  test('parses every type node kind', () => {
    const nodes = [
      { kind: 'widget' },
      { kind: 'void' },
      { kind: 'unknown' },
      { kind: 'scalar', name: 'String' },
      { kind: 'enum', name: 'Axis' },
      { kind: 'named', name: 'Key' },
      { kind: 'nullable', inner: { kind: 'widget' } },
      { kind: 'list', item: { kind: 'widget' } },
      { kind: 'set', item: { kind: 'scalar', name: 'String' } },
      {
        kind: 'map',
        key: { kind: 'scalar', name: 'String' },
        value: { kind: 'scalar', name: 'int' },
      },
      { kind: 'future', item: { kind: 'void' } },
      {
        kind: 'function',
        returnType: { kind: 'void' },
        params: [
          {
            name: 'value',
            type: { kind: 'scalar', name: 'bool' },
            named: false,
            required: true,
          },
        ],
      },
    ];
    const entity = {
      ...widgetEntity,
      constants: nodes.map((node, index) => ({
        name: `constant${index}`,
        type: node,
        display: 'x',
        doc: '',
      })),
    };

    const parsed = parseApiSnapshot(withEntity(entity));
    const [first] = parsed.entities;
    if (first?.kind !== 'widget') {
      throw new Error('expected a widget entity');
    }

    expect(first.constants.map((constant) => constant.type)).toEqual(
      nodes as never,
    );
  });

  describe('rejects malformed documents with precise paths', () => {
    test('non-object root', () => {
      expect(() => parseApiSnapshot(null)).toThrow(
        new Error('api.json: root: expected an object'),
      );
    });

    test('missing meta field', () => {
      expect(() =>
        parseApiSnapshot({ meta: { frameworkVersion: '1' }, entities: [] }),
      ).toThrow(new Error('api.json: meta.dartSdkVersion: expected a string'));
    });

    test('non-array entities', () => {
      expect(() => parseApiSnapshot({ meta, entities: 'nope' })).toThrow(
        new Error('api.json: entities: expected an array'),
      );
    });

    test('unknown entity kind', () => {
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, kind: 'gizmo' })),
      ).toThrow(
        new Error('api.json: entities[0].kind: unknown entity kind "gizmo"'),
      );
    });

    test('non-string supertype', () => {
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, supertypes: [1] })),
      ).toThrow(
        new Error('api.json: entities[0].supertypes[0]: expected a string'),
      );
    });

    test('non-boolean param flag', () => {
      const constructors = [
        {
          name: '',
          doc: '',
          params: [
            {
              name: 'child',
              type: { kind: 'widget' },
              display: 'Widget',
              named: 'yes',
              required: false,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ];
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, constructors })),
      ).toThrow(
        new Error(
          'api.json: entities[0].constructors[0].params[0].named: ' +
            'expected a boolean',
        ),
      );
    });

    test('invalid defaultValue', () => {
      const constructors = [
        {
          name: '',
          doc: '',
          params: [
            {
              name: 'count',
              type: { kind: 'scalar', name: 'int' },
              display: 'int',
              named: true,
              required: false,
              defaultValue: 3,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ];
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, constructors })),
      ).toThrow(
        new Error(
          'api.json: entities[0].constructors[0].params[0].defaultValue: ' +
            'expected a string or null',
        ),
      );
    });

    test('unknown type node kind', () => {
      const constants = [
        { name: 'x', type: { kind: 'blob' }, display: 'x', doc: '' },
      ];
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, constants })),
      ).toThrow(
        new Error(
          'api.json: entities[0].constants[0].type.kind: ' +
            'unknown type kind "blob"',
        ),
      );
    });

    test('unknown scalar name', () => {
      const constants = [
        {
          name: 'x',
          type: { kind: 'scalar', name: 'Decimal' },
          display: 'x',
          doc: '',
        },
      ];
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, constants })),
      ).toThrow(
        new Error(
          'api.json: entities[0].constants[0].type.name: ' +
            'unknown scalar type "Decimal"',
        ),
      );
    });

    test('malformed nested function param type', () => {
      const constants = [
        {
          name: 'onTap',
          type: {
            kind: 'function',
            returnType: { kind: 'void' },
            params: [
              { name: 'value', type: 'nope', named: false, required: true },
            ],
          },
          display: 'x',
          doc: '',
        },
      ];
      expect(() =>
        parseApiSnapshot(withEntity({ ...widgetEntity, constants })),
      ).toThrow(
        new Error(
          'api.json: entities[0].constants[0].type.params[0].type: ' +
            'expected an object',
        ),
      );
    });

    test('malformed enum value', () => {
      expect(() =>
        parseApiSnapshot(withEntity({ ...enumEntity, values: [{ name: 1 }] })),
      ).toThrow(
        new Error('api.json: entities[0].values[0].name: expected a string'),
      );
    });
  });
});
