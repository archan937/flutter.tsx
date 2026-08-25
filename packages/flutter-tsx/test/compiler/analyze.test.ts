import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import {
  analyzeSource,
  requireSourceFile,
  summarize,
} from '@src/compiler/analyze';

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

  test('list states infer List element types from their initializer', () => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [names, setNames] = useState(['a', 'b']);\n" +
        '  const [counts, setCounts] = useState([1, 2]);\n' +
        '  const [scales, setScales] = useState([1.5]);\n' +
        '  const [flags, setFlags] = useState([true]);\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(
      analysis.components[0]?.states.map((state) => state.dartType),
    ).toEqual(['List<String>', 'List<int>', 'List<double>', 'List<bool>']);
  });

  test('an empty list state cannot infer its element type', () => {
    expect(() =>
      analyzeSource(
        "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [items, setItems] = useState([]);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0308 probe.tsx:3:38 — cannot infer the element type of this ' +
          'list state from an empty literal.',
      ),
    );
  });

  test('typed destructured props become prop bindings', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'const Greeting = ({ name, size, bold }: ' +
        '{ name: string; size?: number; bold?: boolean }) => (\n' +
        '  <Text>{name}</Text>\n' +
        ');\n' +
        'export const Probe = () => <Greeting name="hi" />;\n',
      'probe.tsx',
    );

    const greeting = analysis.components.find(
      (component) => component.name === 'Greeting',
    );
    expect(greeting?.props).toEqual([
      { name: 'name', dartType: 'String', required: true },
      { name: 'size', dartType: 'double', required: false },
      { name: 'bold', dartType: 'bool', required: false },
    ]);
    expect(analysis.components.map((component) => component.name)).toEqual([
      'Greeting',
      'Probe',
    ]);
  });

  test('interface and type-alias prop types resolve locally', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'interface CardProps {\n' +
        '  title: string;\n' +
        '}\n' +
        'type BadgeProps = { count: number };\n' +
        'const Card = ({ title }: CardProps) => <Text>{title}</Text>;\n' +
        'const Badge = ({ count }: BadgeProps) => <Text>{count}</Text>;\n' +
        'export const Probe = () => <Card title="hi" />;\n',
      'probe.tsx',
    );

    expect(analysis.components.map((component) => component.props)).toEqual([
      [{ name: 'title', dartType: 'String', required: true }],
      [{ name: 'count', dartType: 'double', required: true }],
      [],
    ]);
  });

  test('a non-object props annotation is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = ({ x }: string) => <Text>hi</Text>;\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0309 probe.tsx:2:30 — props must be destructured with an inline ' +
          'type: `({ name }: { name: string })` (named prop types land at ' +
          'roadmap step 21).',
      ),
    );
  });

  test('an unknown named prop type is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = ({ x }: Mystery) => <Text>hi</Text>;\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0309 probe.tsx:2:30 — props must be destructured with an inline ' +
          'type: `({ name }: { name: string })` (named prop types land at ' +
          'roadmap step 21).',
      ),
    );
  });

  test('setter-less useState marks the state immutable', () => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [titles] = useState(['a']);\n" +
        '  const [count, setCount] = useState(0);\n' +
        '  const [idle, setIdle] = useState(true);\n' +
        '  const bump = () => setCount(count + 1);\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(
      analysis.components[0]?.states.map((state) => ({
        name: state.name,
        mutable: state.mutable,
      })),
    ).toEqual([
      { name: 'titles', mutable: false },
      { name: 'count', mutable: true },
      { name: 'idle', mutable: false },
    ]);
  });

  test('an untyped props parameter is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = (props) => <Text>hi</Text>;\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0309 probe.tsx:2:23 — props must be destructured with an inline ' +
          'type: `({ name }: { name: string })` (named prop types land at ' +
          'roadmap step 21).',
      ),
    );
  });

  test('a method member in a props type is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = ({ run }: { run(): void }) => <Text>hi</Text>;\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0309 probe.tsx:2:34 — props must be destructured with an inline ' +
          'type: `({ name }: { name: string })` (named prop types land at ' +
          'roadmap step 21).',
      ),
    );
  });

  test('a non-scalar prop type is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = ({ when }: { when: Date }) => <Text>hi</Text>;\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0309 probe.tsx:2:41 — props must be destructured with an inline ' +
          'type: `({ name }: { name: string })` (named prop types land at ' +
          'roadmap step 21).',
      ),
    );
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
