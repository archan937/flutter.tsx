import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import {
  analyzeSource,
  requireSourceFile,
  type SourceAnalysis,
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
        'TSX0309 probe.tsx:2:30 — props must be destructured, and their type ' +
          'must be an object type: `({ name }: { name: string })` or an ' +
          'interface declared in this file.',
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
        'TSX0309 probe.tsx:2:30 — props must be destructured, and their type ' +
          'must be an object type: `({ name }: { name: string })` or an ' +
          'interface declared in this file.',
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
        'TSX0309 probe.tsx:2:23 — props must be destructured, and their type ' +
          'must be an object type: `({ name }: { name: string })` or an ' +
          'interface declared in this file.',
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
        'TSX0309 probe.tsx:2:34 — props must be destructured, and their type ' +
          'must be an object type: `({ name }: { name: string })` or an ' +
          'interface declared in this file.',
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
        'TSX0309 probe.tsx:2:41 — props must be destructured, and their type ' +
          'must be an object type: `({ name }: { name: string })` or an ' +
          'interface declared in this file.',
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
describe('analyzeSource — plugin imports', () => {
  test('named imports from plugin modules are exposed per package', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { canLaunchUrl, launchUrl } from 'plugin:url_launcher';\n" +
        "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
        'export const Probe = () => {\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(analysis.pluginImports).toEqual(
      new Map([
        [
          'canLaunchUrl',
          { package: 'url_launcher', exportedName: 'canLaunchUrl' },
        ],
        ['launchUrl', { package: 'url_launcher', exportedName: 'launchUrl' }],
        [
          'useSecureStorage',
          {
            package: 'flutter_secure_storage',
            exportedName: 'useSecureStorage',
          },
        ],
      ]),
    );
  });

  test('an aliased import keeps the name the module exports', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { get as httpGet, delete as httpDelete } from 'plugin:http';\n" +
        'export const Probe = () => <Text>hi</Text>;\n',
      'probe.tsx',
    );

    // A reserved word like `delete` can only be used through an alias, so the
    // local name and the exported name have to be tracked separately.
    expect(analysis.pluginImports).toEqual(
      new Map([
        ['httpGet', { package: 'http', exportedName: 'get' }],
        ['httpDelete', { package: 'http', exportedName: 'delete' }],
      ]),
    );
  });

  test('flutter-tsx imports are not plugin imports', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(analysis.pluginImports).toEqual(new Map());
  });
});
describe('analyzeSource — useAsync', () => {
  const probe = (body: string): SourceAnalysis =>
    analyzeSource(
      "import { CircularProgressIndicator, Text, useAsync } from 'flutter-tsx';\n" +
        "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
        'export const Probe = async () => {\n' +
        '  const storage = useSecureStorage();\n' +
        body +
        '  return <Text>done</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

  test('captures the future, the data name and both fallbacks', () => {
    const analysis = probe(
      '  const hasToken = await useAsync(\n' +
        "    () => storage.containsKey({ key: 'token' }),\n" +
        '    {\n' +
        '      loading: () => <CircularProgressIndicator />,\n' +
        '      error: (err) => <Text>{err}</Text>,\n' +
        '    },\n' +
        '  );\n',
    );
    const [component] = analysis.components;

    expect(component?.asyncBinding?.name).toBe('hasToken');
    expect(component?.asyncBinding?.load.getText()).toBe(
      "storage.containsKey({ key: 'token' })",
    );
    expect(component?.asyncBinding?.loadingJsx.getText()).toBe(
      '<CircularProgressIndicator />',
    );
    expect(component?.asyncBinding?.errorParam).toBe('err');
    expect(component?.asyncBinding?.errorJsx.getText()).toBe(
      '<Text>{err}</Text>',
    );
  });

  test('a component without useAsync has no binding', () => {
    const analysis = probe('');

    expect(analysis.components[0]?.asyncBinding).toBeNull();
  });

  test('a second useAsync is a numbered error', () => {
    expect(() =>
      probe(
        '  const a = await useAsync(() => storage.readAll(), {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n' +
          '  const b = await useAsync(() => storage.readAll(), {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n',
      ),
    ).toThrow(
      new Error(
        'TSX0318 probe.tsx:9:9 — a component compiles one `useAsync`; ' +
          'move the second into a child component.',
      ),
    );
  });

  test('awaiting anything else is a numbered error', () => {
    expect(() => probe('  const a = await storage.readAll();\n')).toThrow(
      new Error(
        'TSX0305 probe.tsx:5:13 — only `useAsync` and `useStream` can be ' +
          'awaited in a component.',
      ),
    );
  });

  test('a malformed useAsync call is a numbered error', () => {
    expect(() =>
      probe('  const a = await useAsync(storage.readAll());\n'),
    ).toThrow(
      new Error(
        'TSX0320 probe.tsx:5:19 — `useAsync` takes an arrow returning the ' +
          'source and an options object: `useAsync(() => load(), ' +
          '{ loading, error })`.',
      ),
    );
  });

  test('missing loading or error fallbacks is a numbered error', () => {
    expect(() =>
      probe(
        '  const a = await useAsync(() => storage.readAll(), {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '  });\n',
      ),
    ).toThrow(
      new Error(
        'TSX0319 probe.tsx:5:9 — `useAsync` needs both a `loading` and an ' +
          '`error` fallback: every builder state must render something.',
      ),
    );
  });
});
describe('analyzeSource — createStore / useStore', () => {
  const analysis = (): SourceAnalysis =>
    analyzeSource(
      "import { Text, createStore, useStore } from 'flutter-tsx';\n" +
        'const counterStore = createStore({\n' +
        '  count: 0,\n' +
        "  label: 'Taps',\n" +
        '  ratio: 1.5,\n' +
        '  live: true,\n' +
        '});\n' +
        'export const Probe = () => {\n' +
        '  const [state, setState] = useStore(counterStore);\n' +
        '  return <Text>{state.count}</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

  test('a module-level store records its typed initial shape', () => {
    expect(analysis().stores).toEqual([
      {
        name: 'counterStore',
        fields: [
          { name: 'count', dartType: 'int', initialText: '0' },
          { name: 'label', dartType: 'String', initialText: "'Taps'" },
          { name: 'ratio', dartType: 'double', initialText: '1.5' },
          { name: 'live', dartType: 'bool', initialText: 'true' },
        ],
      },
    ]);
  });

  test('useStore binds the state and setter names to the store', () => {
    expect(analysis().components[0]?.storeUse).toEqual({
      storeName: 'counterStore',
      stateName: 'state',
      setterName: 'setState',
    });
  });

  test('an unknown store is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text, useStore } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [state, setState] = useStore(ghostStore);\n' +
          '  return <Text>{state.count}</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0322 probe.tsx:3:38 — `ghostStore` is not a store created in ' +
          'this file with `createStore({ … })`.',
      ),
    );
  });

  const storeProbe =
    (source: string): (() => SourceAnalysis) =>
    (): SourceAnalysis =>
      analyzeSource(source, 'probe.tsx');

  test('a malformed useStore destructuring is a numbered error', () => {
    const shapes = [
      '  const state = useStore(counterStore);\n',
      '  const [state] = useStore(counterStore);\n',
      '  const [state, setState] = useStore({ count: 0 });\n',
      '  const [, setState] = useStore(counterStore);\n',
    ];
    for (const shape of shapes) {
      expect(
        storeProbe(
          "import { Text, createStore, useStore } from 'flutter-tsx';\n" +
            'const counterStore = createStore({ count: 0 });\n' +
            'export const Probe = () => {\n' +
            shape +
            '  return <Text>hi</Text>;\n' +
            '};\n',
        ),
      ).toThrow(
        new Error(
          'TSX0324 probe.tsx:4:9 — `useStore` must be destructured as ' +
            '`const [state, setState] = useStore(someStore)`.',
        ),
      );
    }
  });

  test('a store without an object literal is a numbered error', () => {
    expect(
      storeProbe(
        "import { Text, createStore } from 'flutter-tsx';\n" +
          'const bad = createStore();\n' +
          'export const Probe = () => <Text>hi</Text>;\n',
      ),
    ).toThrow(
      new Error(
        'TSX0323 probe.tsx:2:13 — a store field needs a literal the ' +
          'compiler can type: string, number or boolean.',
      ),
    );
  });

  test('a spread store field is a numbered error', () => {
    expect(
      storeProbe(
        "import { Text, createStore } from 'flutter-tsx';\n" +
          'const base = { count: 0 };\n' +
          'const bad = createStore({ ...base });\n' +
          'export const Probe = () => <Text>hi</Text>;\n',
      ),
    ).toThrow(
      new Error(
        'TSX0323 probe.tsx:3:27 — a store field needs a literal the ' +
          'compiler can type: string, number or boolean.',
      ),
    );
  });

  test('a store field the compiler cannot type is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text, createStore, useStore } from 'flutter-tsx';\n" +
          'const badStore = createStore({ when: new Date() });\n' +
          'export const Probe = () => {\n' +
          '  const [state, setState] = useStore(badStore);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0323 probe.tsx:2:38 — a store field needs a literal the ' +
          'compiler can type: string, number or boolean.',
      ),
    );
  });
});
describe('analyzeSource — createRouter / useNavigation', () => {
  const routerSource = (table: string): string =>
    "import { Text, createRouter, useNavigation } from 'flutter-tsx';\n" +
    'export const HomePage = () => {\n' +
    '  const nav = useNavigation();\n' +
    '  return <Text>Home</Text>;\n' +
    '};\n' +
    'export const DetailPage = () => <Text>Detail</Text>;\n' +
    `export const router = createRouter(${table});\n`;

  test('a route table records each path and its component', () => {
    const analysis = analyzeSource(
      routerSource("{ '/': HomePage, '/detail': DetailPage }"),
      'probe.tsx',
    );

    expect(analysis.router).toEqual({
      name: 'router',
      routes: [
        { path: '/', component: 'HomePage' },
        { path: '/detail', component: 'DetailPage' },
      ],
    });
  });

  test('useNavigation binds a navigator name', () => {
    const analysis = analyzeSource(
      routerSource("{ '/': HomePage }"),
      'probe.tsx',
    );

    expect(analysis.components[0]?.navigators).toEqual(['nav']);
  });

  test('a file without a router has none', () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => <Text>hi</Text>;\n',
      'probe.tsx',
    );

    expect(analysis.router).toBeNull();
  });

  test('a route table that is no object literal is a numbered error', () => {
    expect(() => analyzeSource(routerSource('routes'), 'probe.tsx')).toThrow(
      new Error(
        'TSX0327 probe.tsx:7:23 — `createRouter` takes a table of paths to ' +
          "components: `createRouter({ '/': Home })`.",
      ),
    );
  });

  test('a route key that is no string path is a numbered error', () => {
    expect(() =>
      analyzeSource(routerSource('{ [key]: HomePage }'), 'probe.tsx'),
    ).toThrow(
      new Error(
        'TSX0327 probe.tsx:7:38 — `createRouter` takes a table of paths to ' +
          "components: `createRouter({ '/': Home })`.",
      ),
    );
  });

  test('a route whose target is not a component is a numbered error', () => {
    expect(() =>
      analyzeSource(routerSource("{ '/': 'HomePage' }"), 'probe.tsx'),
    ).toThrow(
      new Error(
        'TSX0328 probe.tsx:7:43 — a route must point at a component ' +
          'declared in this file.',
      ),
    );
  });

  test('a route pointing at an unknown component is a numbered error', () => {
    expect(() =>
      analyzeSource(routerSource("{ '/': GhostPage }"), 'probe.tsx'),
    ).toThrow(
      new Error(
        'TSX0328 probe.tsx:7:43 — a route must point at a component ' +
          'declared in this file.',
      ),
    );
  });
});
describe('analyzeSource — JSON models', () => {
  const modelSource =
    "import { Text, json, useAsync } from 'flutter-tsx';\n" +
    'interface Author {\n  name: string;\n}\n' +
    'interface Album {\n' +
    '  id: number;\n' +
    '  title: string;\n' +
    '  tags: string[];\n' +
    '  author: Author;\n' +
    '  subtitle?: string;\n' +
    '}\n' +
    'export const Probe = () => {\n' +
    '  const album = json(raw) as Album;\n' +
    '  return <Text>{album.title}</Text>;\n' +
    '};\n';

  test('an interface becomes a model with typed fields', () => {
    const analysis = analyzeSource(modelSource, 'probe.tsx');

    expect(analysis.models).toEqual([
      {
        name: 'Author',
        fields: [{ name: 'name', dartType: 'String', required: true }],
      },
      {
        name: 'Album',
        fields: [
          // JSON numbers may be int or double, and `as double` throws on an
          // integer, so num is the only safe mapping.
          { name: 'id', dartType: 'num', required: true },
          { name: 'title', dartType: 'String', required: true },
          { name: 'tags', dartType: 'List<String>', required: true },
          { name: 'author', dartType: 'Author', required: true },
          { name: 'subtitle', dartType: 'String', required: false },
        ],
      },
    ]);
  });

  test('a component body records its locals in order', () => {
    const analysis = analyzeSource(modelSource, 'probe.tsx');
    const locals = analysis.components[0]?.locals ?? [];

    expect(locals.map((local) => local.name)).toEqual(['album']);
    expect(locals[0]?.expression.getText()).toBe('json(raw) as Album');
  });

  test('an interface that is never decoded is not a model', () => {
    // A props interface stays a props interface: no Dart class, and no
    // model validation applied to it.
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'interface TaskProps {\n  title: string;\n}\n' +
        'export const Probe = ({ title }: TaskProps) => <Text>{title}</Text>;\n',
      'probe.tsx',
    );

    expect(analysis.models).toEqual([]);
  });

  test('a field type the compiler cannot map is a numbered error', () => {
    expect(() =>
      analyzeSource(
        "import { Text, json } from 'flutter-tsx';\n" +
          'interface Bad {\n  when: Date;\n}\n' +
          'export const Probe = () => {\n' +
          '  const bad = json(raw) as Bad;\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toThrow(
      new Error(
        'TSX0334 probe.tsx:3:3 — `when` has a type the compiler cannot map ' +
          'to Dart: use a string, number, boolean, another interface in this ' +
          'file, or a list of those.',
      ),
    );
  });
});
