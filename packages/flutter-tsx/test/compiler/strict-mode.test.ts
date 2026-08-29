import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';

// Every construct the vision forbids (§11), each with the code it must
// report. A forbidden feature is refused by name rather than reaching the
// lowering as a vague "not compiled yet".
const FORBIDDEN: [string, string, string][] = [
  [
    'TSX1001',
    'any',
    'export const A = ({ x }: { x: any }) => <Text>{x}</Text>;',
  ],
  ['TSX1002', 'eval', "export const A = () => <Text>{eval('1')}</Text>;"],
  [
    'TSX1003',
    'Proxy',
    'export const A = () => <Text>{new Proxy({}, {})}</Text>;',
  ],
  ['TSX1004', 'Symbol', "export const A = () => <Text>{Symbol('x')}</Text>;"],
  [
    'TSX1005',
    'WeakMap',
    'export const A = () => <Text>{new WeakMap()}</Text>;',
  ],
  [
    'TSX1006',
    'prototype',
    'export const A = () => <Text>{Object.prototype}</Text>;',
  ],
  [
    'TSX1006',
    'Object.setPrototypeOf',
    'export const A = () => <Text>{Object.setPrototypeOf({}, null)}</Text>;',
  ],
  [
    'TSX1007',
    'Object.assign',
    'export const A = () => <Text>{Object.assign({}, {})}</Text>;',
  ],
  [
    'TSX1008',
    'typeof',
    'export const A = ({ x }: { x: string }) => <Text>{typeof x}</Text>;',
  ],
  [
    'TSX1009',
    'index signature',
    'interface Bag {\n  [key: string]: string;\n}\n' +
      'export const A = ({ bag }: { bag: Bag }) => <Text>{bag}</Text>;',
  ],
  [
    'TSX1010',
    'namespace',
    'namespace Util {}\nexport const A = () => <Text>x</Text>;',
  ],
  [
    'TSX1011',
    'declare',
    'declare const version: string;\nexport const A = () => <Text>x</Text>;',
  ],
  [
    'TSX2001',
    'union',
    'export const A = ({ x }: { x: string | number }) => <Text>{x}</Text>;',
  ],
  [
    'TSX2002',
    'mapped type',
    'type Flags = { [K in string]: boolean };\n' +
      'export const A = ({ f }: { f: Flags }) => <Text>{f}</Text>;',
  ],
  [
    'TSX2003',
    'conditional type',
    'type Kind<T> = T extends string ? number : boolean;\n' +
      'export const A = () => <Text>x</Text>;',
  ],
  [
    'TSX2004',
    'infer',
    'type Item<T> = T extends Array<infer U> ? U : never;\n' +
      'export const A = () => <Text>x</Text>;',
  ],
  [
    'TSX2005',
    'Reflect',
    'export const A = () => <Text>{Reflect.ownKeys({})}</Text>;',
  ],
  [
    'TSX2006',
    'generator',
    'function* items() {\n  yield 1;\n}\nexport const A = () => <Text>x</Text>;',
  ],
  [
    'TSX3001',
    'dynamic import',
    "export const A = () => <Text>{import('./other')}</Text>;",
  ],
  ['TSX3002', 'require', "export const A = () => <Text>{require('x')}</Text>;"],
];

describe('TSX strict mode', () => {
  for (const [code, label, source] of FORBIDDEN) {
    test(`${code} — ${label}`, () => {
      expect(
        transpileComponent({ source, filePath: '/tmp/A.tsx' }),
      ).rejects.toThrow(new RegExp(`^${code} `));
    });
  }

  test('a union with null is allowed, since Dart has nullable types', async () => {
    const dart = await transpileComponent({
      source:
        'export const A = ({ x }: { x?: string }) => ' +
        "<Text>{x ?? ''}</Text>;\n",
      filePath: '/tmp/A.tsx',
    });

    expect(dart).toContain('final String? x;');
  });

  test('a union of string literals is allowed', async () => {
    const dart = await transpileComponent({
      source:
        "export const A = ({ tone }: { tone: 'warn' | 'ok' }) => " +
        '<Text>{tone}</Text>;\n',
      filePath: '/tmp/A.tsx',
    });

    expect(dart).toContain('final String tone;');
  });
});
