import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { printExpr } from '@src/compiler/dart-print';
import { analyzeSource } from '@src/compiler/front-end';
import { irWidgetToDart } from '@src/compiler/ir-to-dart';
import {
  buildCompileContext,
  type CompileContext,
  lowerComponent,
} from '@src/compiler/lower';
import { deriveSlots } from '@src/derive/slots';

const fixturePath = new URL(
  '../fixtures/01-camera-screen/input.tsx',
  import.meta.url,
);

let context: CompileContext | undefined;
const contextOnce = async (): Promise<CompileContext> => {
  const snapshot = await loadApiSnapshot();
  context ??= buildCompileContext(snapshot, deriveSlots(snapshot));
  return context;
};

const printFirstBody = async (
  source: string,
  filePath: string,
): Promise<string> => {
  const analysis = analyzeSource(source, filePath);
  const [component] = analysis.components;
  if (component === undefined) {
    throw new Error('expected a component');
  }
  const ir = lowerComponent(component, await contextOnce());
  return printExpr(irWidgetToDart(ir.body, { privateMembers: true }));
};

describe('irWidgetToDart — camera fixture', () => {
  test('prints the exact widget tree', async () => {
    const source = await Bun.file(fixturePath).text();

    expect(await printFirstBody(source, 'input.tsx')).toBe(
      [
        'Column(',
        '  children: [',
        "    if (_taken) const Text('Photo saved!'),",
        '    ElevatedButton(',
        '      onPressed: _takePhoto,',
        "      child: const Text('Take Photo'),",
        '    ),',
        '  ],',
        ')',
      ].join('\n'),
    );
  });
});

describe('irWidgetToDart — const inference and value kinds', () => {
  test('fully literal trees are const; enums and numbers print exactly', async () => {
    expect(
      await printFirstBody(
        "import { Center, Column, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Column mainAxisAlignment="center">\n' +
          '    <Center widthFactor={2} heightFactor={1.5}>\n' +
          '      <Text softWrap={true}>hi</Text>\n' +
          '    </Center>\n' +
          '  </Column>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      [
        'const Column(',
        '  mainAxisAlignment: MainAxisAlignment.center,',
        '  children: [',
        '    Center(',
        '      widthFactor: 2,',
        '      heightFactor: 1.5,',
        "      child: Text('hi', softWrap: true),",
        '    ),',
        '  ],',
        ')',
      ].join('\n'),
    );
  });

  test('raw expressions print as their source text', async () => {
    expect(
      await printFirstBody(
        "import { Column } from 'flutter-tsx';\n" +
          'export const Probe = () => <Column>{40 + 2}</Column>;\n',
        'probe.tsx',
      ),
    ).toBe(['Column(', '  children: [', '    40 + 2,', '  ],', ')'].join('\n'));
  });

  test('public naming keeps identifiers bare', async () => {
    const analysis = analyzeSource(
      "import { Column, Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [label, setLabel] = useState('x');\n" +
        '  return <Column>{label}</Column>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await contextOnce());

    expect(printExpr(irWidgetToDart(ir.body, { privateMembers: false }))).toBe(
      ['Column(', '  children: [', '    label,', '  ],', ')'].join('\n'),
    );
  });
});
