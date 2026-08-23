import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot } from '@src/api/model';
import { serializeApiSnapshot } from '@src/api/serialize';

const snapshot: ApiSnapshot = {
  meta: {
    frameworkVersion: '3.47.1',
    dartSdkVersion: '3.13.1',
    frameworkRevision: 'abc123',
  },
  entities: [
    {
      kind: 'class',
      name: 'Alpha',
      library: 'widgets',
      doc: '',
      supertypes: [],
      constructors: [],
      constants: [],
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
  "entities": [
    {
      "kind": "class",
      "name": "Alpha",
      "library": "widgets",
      "doc": "",
      "supertypes": [],
      "constructors": [],
      "constants": []
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
