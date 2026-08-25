import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';

const HELLO_SOURCE = `import { Center, Column, Text } from 'flutter-tsx';

export const HelloScreen = () => (
  <Column mainAxisAlignment="center">
    <Text>Hello Flutter.tsx</Text>
    <Center>
      <Text>It works!</Text>
    </Center>
  </Column>
);
`;

const HELLO_DART = `import 'package:flutter/material.dart';

class HelloScreen extends StatelessWidget {
  const HelloScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Hello Flutter.tsx'),
        Center(child: Text('It works!')),
      ],
    );
  }
}
`;

describe('transpileComponent — stateless components', () => {
  test('emits the complete Dart file', async () => {
    expect(
      await transpileComponent({ source: HELLO_SOURCE, filePath: 'hello.tsx' }),
    ).toBe(HELLO_DART);
  });

  test('cupertino-only widgets import just the cupertino library', async () => {
    expect(
      await transpileComponent({
        source:
          "import { Center, CupertinoActivityIndicator } from 'flutter-tsx';\n" +
          'export const Spinner = () => (\n' +
          '  <Center>\n' +
          '    <CupertinoActivityIndicator />\n' +
          '  </Center>\n' +
          ');\n',
        filePath: 'spinner.tsx',
      }),
    ).toBe(
      `import 'package:flutter/cupertino.dart';

class Spinner extends StatelessWidget {
  const Spinner({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CupertinoActivityIndicator());
  }
}
`,
    );
  });

  test('mixed material and cupertino widgets import both libraries', async () => {
    expect(
      await transpileComponent({
        source:
          "import { Card, CupertinoActivityIndicator } from 'flutter-tsx';\n" +
          'export const MixedScreen = () => (\n' +
          '  <Card>\n' +
          '    <CupertinoActivityIndicator />\n' +
          '  </Card>\n' +
          ');\n',
        filePath: 'mixed.tsx',
      }),
    ).toBe(
      `import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class MixedScreen extends StatelessWidget {
  const MixedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Card(child: CupertinoActivityIndicator());
  }
}
`,
    );
  });
  test('names no barrel re-exports pull in their defining library', async () => {
    expect(
      await transpileComponent({
        source:
          "import { SensitiveContent, Text } from 'flutter-tsx';\n" +
          'export const Sensitive = () => (\n' +
          '  <SensitiveContent sensitivity="autoSensitive">\n' +
          '    <Text>hi</Text>\n' +
          '  </SensitiveContent>\n' +
          ');\n',
        filePath: 'sensitive.tsx',
      }),
    ).toBe(
      `import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class Sensitive extends StatelessWidget {
  const Sensitive({super.key});

  @override
  Widget build(BuildContext context) {
    return const SensitiveContent(
      sensitivity: ContentSensitivity.autoSensitive,
      child: Text('hi'),
    );
  }
}
`,
    );
  });
});

describe('transpileComponent — stateful components', () => {
  test('useState and a named handler emit the full StatefulWidget', async () => {
    const source = await Bun.file(
      new URL('../fixtures/05-counter/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/05-counter/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'counter.tsx' })).toBe(
      expected,
    );
  });

  test('mount effects, ternaries, and inline handlers emit in full', async () => {
    const source = await Bun.file(
      new URL('../fixtures/06-mount-effect/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/06-mount-effect/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'status.tsx' })).toBe(
      expected,
    );
  });

  test('list rendering emits a collection-for', async () => {
    const source = await Bun.file(
      new URL('../fixtures/07-list-rendering/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/07-list-rendering/expected.dart', import.meta.url),
    ).text();

    expect(
      await transpileComponent({ source, filePath: 'groceries.tsx' }),
    ).toBe(expected);
  });

  test('user components compose with typed constructor props', async () => {
    const source = await Bun.file(
      new URL('../fixtures/08-composition/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/08-composition/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'welcome.tsx' })).toBe(
      expected,
    );
  });

  test('props on a stateful component are a numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = ({ label }: { label: string }) => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  return <Text>{label}</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0310 probe.tsx:2:14 — <Probe> combines props and state — ' +
          'stateful components with props land at a later roadmap step.',
      ),
    );
  });

  test('named prop types, fragments, and final fields emit in full', async () => {
    const source = await Bun.file(
      new URL('../fixtures/09-typed-props/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/09-typed-props/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'tasks.tsx' })).toBe(
      expected,
    );
  });

  test('async handlers become async methods', async () => {
    expect(
      await transpileComponent({
        source:
          "import { ElevatedButton, useState } from 'flutter-tsx';\n" +
          'export const Saver = () => {\n' +
          '  const [saved, setSaved] = useState(false);\n' +
          '  const save = async () => {\n' +
          '    setSaved(true);\n' +
          '  };\n' +
          '  return <ElevatedButton onClick={save}>Save</ElevatedButton>;\n' +
          '};\n',
        filePath: 'saver.tsx',
      }),
    ).toBe(
      `import 'package:flutter/material.dart';

class Saver extends StatefulWidget {
  const Saver({super.key});

  @override
  State<Saver> createState() => _SaverState();
}

class _SaverState extends State<Saver> {
  bool _saved = false;

  Future<void> _save() async {
    setState(() {
      _saved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(onPressed: _save, child: const Text('Save'));
  }
}
`,
    );
  });
});

describe('transpileComponent — not yet supported', () => {
  test('plugin hooks are an honest numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          "import { useCamera } from 'plugin:camera';\n" +
          'export const Probe = () => {\n' +
          '  const cam = useCamera();\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0304 probe.tsx:3:14 — <Probe> uses plugin hooks — plugin ' +
          'compilation lands at roadmap step 22.',
      ),
    );
  });
});
