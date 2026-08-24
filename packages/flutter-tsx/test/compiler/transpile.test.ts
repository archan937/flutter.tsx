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
});

describe('transpileComponent — not yet supported', () => {
  test('stateful components are an honest numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0301 probe.tsx:2:14 — <Probe> uses state, plugins, effects, or ' +
          'handlers — only plain stateless components compile yet (stateful ' +
          'support lands at roadmap step 17).',
      ),
    );
  });
});
