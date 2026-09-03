import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot } from '@src/api/model';
import { serializeApiSnapshot } from '@src/api/serialize';

const snapshot: ApiSnapshot = {
  meta: {
    frameworkVersion: '3.47.1',
    dartSdkVersion: '3.13.1',
    frameworkRevision: 'abc123',
  },
  hierarchy: { Zeta: [], Alpha: ['Base'], Beta: ['Listenable'] },
  exports: {},
  entities: [
    {
      kind: 'class',
      disposable: false,
      isAbstract: false,
      abstractMethods: [],
      abstractGetters: [],
      mixin: null,
      typeParams: [],
      typeParamBounds: [],
      supertypeBindings: {},
      name: 'Alpha',
      library: 'widgets',
      doc: '',
      supertypes: [],
      constructors: [],
      constants: [],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      // A delegate is written by an app, so what it must write travels with
      // it: the abstract surface and the mixin being one calls for.
      kind: 'class',
      disposable: false,
      isAbstract: true,
      abstractMethods: [
        {
          name: 'build',
          doc: '',
          returnType: { kind: 'widget' },
          params: [],
        },
      ],
      abstractGetters: [
        { name: 'extent', type: { kind: 'scalar', name: 'double' }, doc: '' },
      ],
      mixin: 'ChangeNotifier',
      typeParams: ['T'],
      typeParamBounds: ['Object'],
      supertypeBindings: {},
      name: 'Beta',
      library: 'widgets',
      doc: '',
      supertypes: ['Listenable'],
      constructors: [],
      constants: [],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      kind: 'enum',
      name: 'Zeta',
      library: 'material',
      doc: '',
      values: [{ name: 'one', doc: '' }],
    },
  ],
};

describe('serializeApiSnapshot', () => {
  test('produces the exact canonical document the Dart extractor writes', () => {
    const expected = `{
  "meta": {
    "frameworkVersion": "3.47.1",
    "dartSdkVersion": "3.13.1",
    "frameworkRevision": "abc123"
  },
  "hierarchy": {
    "Alpha": [
      "Base"
    ],
    "Beta": [
      "Listenable"
    ],
    "Zeta": []
  },
  "exports": {},
  "entities": [
    {
      "kind": "class",
      "name": "Alpha",
      "library": "widgets",
      "doc": "",
      "supertypes": [],
      "constructors": [],
      "constants": [],
      "fields": [],
      "disposable": false
    },
    {
      "kind": "class",
      "name": "Beta",
      "library": "widgets",
      "doc": "",
      "supertypes": [
        "Listenable"
      ],
      "constructors": [],
      "constants": [],
      "fields": [],
      "disposable": false,
      "abstract": true,
      "abstractMethods": [
        {
          "name": "build",
          "doc": "",
          "static": false,
          "returnType": {
            "kind": "widget"
          },
          "params": []
        }
      ],
      "abstractGetters": [
        {
          "name": "extent",
          "doc": "",
          "type": {
            "kind": "scalar",
            "name": "double"
          }
        }
      ],
      "mixin": "ChangeNotifier",
      "typeParams": [
        "T"
      ],
      "typeParamBounds": [
        "Object"
      ]
    },
    {
      "kind": "enum",
      "name": "Zeta",
      "library": "material",
      "doc": "",
      "values": [
        {
          "name": "one",
          "doc": ""
        }
      ]
    }
  ]
}
`;
    expect(serializeApiSnapshot(snapshot)).toBe(expected);
  });
});
