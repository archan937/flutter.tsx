import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { analyzeSource } from '@src/compiler/analyze';
import { printExpr } from '@src/compiler/dart-print';
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
        "    ElevatedButton(onPressed: _takePhoto, child: const Text('Take Photo')),",
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

  test('scalar expression children wrap in an interpolated Text', async () => {
    expect(
      await printFirstBody(
        "import { Column } from 'flutter-tsx';\n" +
          'export const Probe = () => <Column>{40 + 2}</Column>;\n',
        'probe.tsx',
      ),
    ).toBe("Column(children: [Text('${40 + 2}')])");
  });

  test('non-const constructors stay bare while constable args get const', async () => {
    expect(
      await printFirstBody(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Container padding={16} color="#7B1FA2" alignment="center">\n' +
          '    <Text>Styled</Text>\n' +
          '  </Container>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      [
        'Container(',
        '  padding: const EdgeInsets.all(16),',
        '  color: const Color(0xFF7B1FA2),',
        '  alignment: AlignmentGeometry.center,',
        "  child: const Text('Styled'),",
        ')',
      ].join('\n'),
    );
  });

  test('style objects construct a TextStyle with recursive value forms', async () => {
    expect(
      await printFirstBody(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Text style={{ color: "white", fontSize: 18, fontWeight: "bold", fontStyle: "italic" }}>\n' +
          '    hi\n' +
          '  </Text>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      [
        'const Text(',
        "  'hi',",
        '  style: TextStyle(',
        '    color: Colors.white,',
        '    fontSize: 18,',
        '    fontWeight: FontWeight.bold,',
        '    fontStyle: FontStyle.italic,',
        '  ),',
        ')',
      ].join('\n'),
    );
  });

  test('edge-inset objects pick symmetric or only constructors', async () => {
    expect(
      await printFirstBody(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Container padding={{ horizontal: 12 }} margin={{ top: 8, left: 4 }}>\n' +
          '    <Text>hi</Text>\n' +
          '  </Container>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      [
        'Container(',
        '  padding: const EdgeInsets.symmetric(horizontal: 12),',
        '  margin: const EdgeInsets.only(top: 8, left: 4),',
        "  child: const Text('hi'),",
        ')',
      ].join('\n'),
    );
  });

  test('imported constant namespaces lower to constant references', async () => {
    expect(
      await printFirstBody(
        "import { Colors, Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Container color={Colors.deepPurple}>\n' +
          '    <Text>hi</Text>\n' +
          '  </Container>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe("Container(color: Colors.deepPurple, child: const Text('hi'))");
  });

  test('widget elements passed as props lower to constructor slots', async () => {
    expect(
      await printFirstBody(
        "import { AppBar, Scaffold, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Scaffold\n' +
          '    appBar={<AppBar title={<Text>Hi</Text>} />}\n' +
          '    body={<Text>body</Text>}\n' +
          '  />\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      "Scaffold(appBar: AppBar(title: const Text('Hi')), body: const Text('body'))",
    );
  });

  test('empty inline handlers become closures with the Dart arity', async () => {
    expect(
      await printFirstBody(
        "import { Column, Switch } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Column>\n' +
          '    <Switch value={true} onChanged={() => {}} />\n' +
          '    <Switch value={false} onChanged={(enabled) => {}} />\n' +
          '    <Switch value={false} onChanged={(_ignored) => {}} />\n' +
          '  </Column>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).toBe(
      [
        'Column(',
        '  children: [',
        '    Switch(value: true, onChanged: (_) {}),',
        '    Switch(value: false, onChanged: (enabled) {}),',
        '    Switch(value: false, onChanged: (_) {}),',
        '  ],',
        ')',
      ].join('\n'),
    );
  });

  test('string-state children print as a plain Text argument', async () => {
    expect(
      await printFirstBody(
        "import { Column, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          "  const [label, setLabel] = useState('x');\n" +
          '  return <Column>{label}</Column>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).toBe('Column(children: [Text(_label)])');
  });

  test('public naming keeps state references bare', async () => {
    const analysis = analyzeSource(
      "import { Column, Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [taken, setTaken] = useState(false);\n' +
        '  return <Column>{taken && <Text>x</Text>}</Column>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await contextOnce());

    expect(printExpr(irWidgetToDart(ir.body, { privateMembers: false }))).toBe(
      "Column(children: [if (taken) const Text('x')])",
    );
  });
});
