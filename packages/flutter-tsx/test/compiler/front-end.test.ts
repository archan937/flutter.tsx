import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import {
  analyzeSource,
  requireSourceFile,
  summarize,
} from '@src/compiler/front-end';

const fixturePath = new URL(
  '../fixtures/01-camera-screen/input.tsx',
  import.meta.url,
);

describe('analyzeSource — camera fixture', () => {
  test('produces the complete component analysis', async () => {
    const source = await Bun.file(fixturePath).text();
    const analysis = analyzeSource(source, 'input.tsx');

    expect(analysis.components.map(summarize)).toEqual([
      {
        name: 'CameraScreen',
        states: [
          {
            name: 'taken',
            setterName: 'setTaken',
            initialText: 'false',
            dartType: 'bool',
          },
        ],
        plugins: [{ binding: 'cam', hook: 'useCamera', package: 'camera' }],
        handlers: [{ name: 'takePhoto', isAsync: true }],
        effectCount: 0,
        returnTag: 'Column',
      },
    ]);
  });
});

describe('analyzeSource — component shapes', () => {
  test('a stateless component analyzes to an empty model', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Hello = () => <Text>Hi</Text>;\n',
      'hello.tsx',
    );

    expect(analysis.components.map(summarize)).toEqual([
      {
        name: 'Hello',
        states: [],
        plugins: [],
        handlers: [],
        effectCount: 0,
        returnTag: 'Text',
      },
    ]);
  });

  test('self-closing roots are components too', () => {
    const analysis = analyzeSource(
      "import { Spacer } from 'flutter-tsx';\n" +
        'export const Gap = () => <Spacer />;\n',
      'gap.tsx',
    );

    expect(analysis.components.map(summarize)[0]?.returnTag).toBe('Spacer');
  });

  test('state types are inferred from the initial value', () => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        '  const [scale, setScale] = useState(1.5);\n' +
        "  const [label, setLabel] = useState('hi');\n" +
        '  const [busy, setBusy] = useState(false);\n' +
        '  return <Text>{label}</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(analysis.components.map(summarize)).toEqual([
      {
        name: 'Probe',
        states: [
          {
            name: 'count',
            setterName: 'setCount',
            initialText: '0',
            dartType: 'int',
          },
          {
            name: 'scale',
            setterName: 'setScale',
            initialText: '1.5',
            dartType: 'double',
          },
          {
            name: 'label',
            setterName: 'setLabel',
            initialText: "'hi'",
            dartType: 'String',
          },
          {
            name: 'busy',
            setterName: 'setBusy',
            initialText: 'false',
            dartType: 'bool',
          },
        ],
        plugins: [],
        handlers: [],
        effectCount: 0,
        returnTag: 'Text',
      },
    ]);
  });

  test('useEffect calls are counted', () => {
    const analysis = analyzeSource(
      "import { Text, useEffect } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  useEffect(() => {}, []);\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(analysis.components.map(summarize)[0]?.effectCount).toBe(1);
  });
});

describe('analyzeSource — diagnostics', () => {
  test('a file without any component is a numbered error', () => {
    expect(() =>
      analyzeSource('export const answer = 42;\n', 'empty.tsx'),
    ).toThrow(
      new Error(
        'TSX0103 empty.tsx:1:1 — no exported component found: export a ' +
          'const arrow function that returns JSX.',
      ),
    );
  });

  test('exported arrows without JSX are not components', () => {
    expect(() =>
      analyzeSource(
        'export const compute = () => {\n  return 42;\n};\n' +
          'export const answer = () => 42;\n',
        'compute.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0103 compute.tsx:1:1 — no exported component found: export a ' +
          'const arrow function that returns JSX.',
      ),
    );
  });

  test('useState without array destructuring is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const state = useState(0);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0102 probe.tsx:3:9 — useState must be destructured as ' +
          '`const [value, setValue] = useState(...)`.',
      ),
    );
  });

  test('useState without an initial value is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [x, setX] = useState();\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0102 probe.tsx:3:9 — useState must be destructured as ' +
          '`const [value, setValue] = useState(...)`.',
      ),
    );
  });

  test('requireSourceFile rejects a file the program does not know', () => {
    const program = ts.createProgram(['hello.tsx'], {
      noResolve: true,
      noLib: true,
    });

    expect(() => requireSourceFile(program, 'other.tsx')).toThrow(
      new Error('TSX0100 other.tsx:1:1 — could not parse other.tsx'),
    );
  });
});
