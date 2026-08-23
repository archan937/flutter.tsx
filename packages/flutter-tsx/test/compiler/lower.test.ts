import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { analyzeSource } from '@src/compiler/front-end';
import type { IrComponent } from '@src/compiler/ir';
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

const lowerFirst = async (
  source: string,
  filePath: string,
): Promise<IrComponent> => {
  const analysis = analyzeSource(source, filePath);
  const [component] = analysis.components;
  if (component === undefined) {
    throw new Error('expected a component');
  }
  return lowerComponent(component, await contextOnce());
};

describe('lowerComponent — camera fixture', () => {
  test('produces the complete IR', async () => {
    const source = await Bun.file(fixturePath).text();
    const ir = await lowerFirst(source, 'input.tsx');

    expect(ir.name).toBe('CameraScreen');
    expect(ir.kind).toBe('stateful');
    expect(ir.body).toEqual({
      name: 'Column',
      args: [
        {
          param: 'children',
          positional: false,
          value: {
            kind: 'widgetList',
            items: [
              {
                kind: 'if',
                condition: { kind: 'stateRef', name: 'taken' },
                child: {
                  kind: 'value',
                  value: {
                    kind: 'widget',
                    widget: {
                      name: 'Text',
                      args: [
                        {
                          param: 'data',
                          positional: true,
                          value: { kind: 'string', value: 'Photo saved!' },
                        },
                      ],
                    },
                  },
                },
              },
              {
                kind: 'value',
                value: {
                  kind: 'widget',
                  widget: {
                    name: 'ElevatedButton',
                    args: [
                      {
                        param: 'onPressed',
                        positional: false,
                        value: { kind: 'handlerRef', name: 'takePhoto' },
                      },
                      {
                        param: 'child',
                        positional: false,
                        value: {
                          kind: 'widget',
                          widget: {
                            name: 'Text',
                            args: [
                              {
                                param: 'data',
                                positional: true,
                                value: { kind: 'string', value: 'Take Photo' },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    });
  });
});

describe('lowerComponent — attribute values', () => {
  test('enums, strings, numbers, booleans, and single-child slots', async () => {
    const ir = await lowerFirst(
      "import { Center, Column, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Column mainAxisAlignment="center">\n' +
        '    <Center widthFactor={2} heightFactor={1.5}>\n' +
        '      <Text maxLines={3} softWrap={true}>hi</Text>\n' +
        '    </Center>\n' +
        '  </Column>\n' +
        ');\n',
      'probe.tsx',
    );

    expect(ir.kind).toBe('stateless');
    expect(ir.body).toEqual({
      name: 'Column',
      args: [
        {
          param: 'mainAxisAlignment',
          positional: false,
          value: {
            kind: 'enumValue',
            enumName: 'MainAxisAlignment',
            member: 'center',
          },
        },
        {
          param: 'children',
          positional: false,
          value: {
            kind: 'widgetList',
            items: [
              {
                kind: 'value',
                value: {
                  kind: 'widget',
                  widget: {
                    name: 'Center',
                    args: [
                      {
                        param: 'widthFactor',
                        positional: false,
                        value: { kind: 'number', value: '2' },
                      },
                      {
                        param: 'heightFactor',
                        positional: false,
                        value: { kind: 'number', value: '1.5' },
                      },
                      {
                        param: 'child',
                        positional: false,
                        value: {
                          kind: 'widget',
                          widget: {
                            name: 'Text',
                            args: [
                              {
                                param: 'data',
                                positional: true,
                                value: { kind: 'string', value: 'hi' },
                              },
                              {
                                param: 'maxLines',
                                positional: false,
                                value: { kind: 'number', value: '3' },
                              },
                              {
                                param: 'softWrap',
                                positional: false,
                                value: { kind: 'boolean', value: true },
                              },
                            ],
                          },
                        },
                      },
                    ],
                  },
                },
              },
            ],
          },
        },
      ],
    });
  });
});

describe('lowerComponent — value edge cases', () => {
  test('strings, false, quoted expressions, bare attrs, raw values', async () => {
    const ir = await lowerFirst(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const factor = 3;\n' +
        '  return (\n' +
        '    <Text semanticsLabel="spoken" softWrap={false} textScaleFactor={factor} maxLines={}>\n' +
        '      hi\n' +
        '    </Text>\n' +
        '  );\n' +
        '};\n',
      'probe.tsx',
    );

    const values = ir.body.args.map((argument) => ({
      param: argument.param,
      kind: argument.value.kind,
    }));
    expect(values).toEqual([
      { param: 'data', kind: 'string' },
      { param: 'semanticsLabel', kind: 'string' },
      { param: 'softWrap', kind: 'boolean' },
      { param: 'textScaleFactor', kind: 'raw' },
      { param: 'maxLines', kind: 'raw' },
    ]);
    expect(ir.body.args[2]?.value).toEqual({ kind: 'boolean', value: false });
  });

  test('quoted string expressions and bare boolean attributes', async () => {
    const ir = await lowerFirst(
      "import { Text } from 'flutter-tsx';\n" +
        "export const Probe = () => <Text semanticsLabel={'spoken'} softWrap>hi</Text>;\n",
      'probe.tsx',
    );

    expect(ir.body.args).toEqual([
      {
        param: 'data',
        positional: true,
        value: { kind: 'string', value: 'hi' },
      },
      {
        param: 'semanticsLabel',
        positional: false,
        value: { kind: 'string', value: 'spoken' },
      },
      {
        param: 'softWrap',
        positional: false,
        value: { kind: 'boolean', value: true },
      },
    ]);
  });

  test('plain text and raw expressions inside a children list', async () => {
    const ir = await lowerFirst(
      "import { Column, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [label, setLabel] = useState('x');\n" +
        '  return (\n' +
        '    <Column>\n' +
        '      hello\n' +
        '      {label}\n' +
        '    </Column>\n' +
        '  );\n' +
        '};\n',
      'probe.tsx',
    );

    expect(ir.body.args).toEqual([
      {
        param: 'children',
        positional: false,
        value: {
          kind: 'widgetList',
          items: [
            {
              kind: 'value',
              value: {
                kind: 'widget',
                widget: {
                  name: 'Text',
                  args: [
                    {
                      param: 'data',
                      positional: true,
                      value: { kind: 'string', value: 'hello' },
                    },
                  ],
                },
              },
            },
            {
              kind: 'value',
              value: { kind: 'stateRef', name: 'label' },
            },
          ],
        },
      },
    ]);
  });

  test('non-literal expressions stay raw; empty single slots vanish', async () => {
    const ir = await lowerFirst(
      "import { Center, Column, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Column>\n' +
        '    <Text textScaleFactor={1 + 1}>hi</Text>\n' +
        '    {40 + 2}\n' +
        '    <Center>\n' +
        '    </Center>\n' +
        '  </Column>\n' +
        ');\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    const kinds = children.value.items.map((item) =>
      item.kind === 'value' ? item.value.kind : item.kind,
    );
    expect(kinds).toEqual(['widget', 'raw', 'widget']);

    const [textItem, , centerItem] = children.value.items;
    if (
      textItem?.kind !== 'value' ||
      textItem.value.kind !== 'widget' ||
      centerItem?.kind !== 'value' ||
      centerItem.value.kind !== 'widget'
    ) {
      throw new Error('expected widget items');
    }
    expect(
      textItem.value.widget.args.map((argument) => argument.value.kind),
    ).toEqual(['string', 'raw']);
    expect(centerItem.value.widget.args).toEqual([]);
  });

  test('a non-element return is a numbered error', async () => {
    const compile = await contextOnce();
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    const initializer = component?.states[0]?.initializer;
    if (component === undefined || initializer === undefined) {
      throw new Error('expected an analyzed component');
    }

    expect(() =>
      lowerComponent({ ...component, returnJsx: initializer }, compile),
    ).toThrow(
      new Error(
        'TSX0204 probe.tsx:3:38 — a component must return a widget element.',
      ),
    );
  });

  test('an invalid enum member is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Column } from 'flutter-tsx';\n" +
          'export const Probe = () => <Column mainAxisAlignment="diagonal" />;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0203 probe.tsx:2:54 — `diagonal` is not a MainAxisAlignment ' +
          'member.',
      ),
    );
  });
});

describe('lowerComponent — diagnostics', () => {
  test('an unknown widget is a numbered error', () => {
    expect(
      lowerFirst('export const Probe = () => <Blorb />;\n', 'probe.tsx'),
    ).rejects.toThrow(
      new Error(
        'TSX0201 probe.tsx:1:29 — unknown widget <Blorb>: not a Flutter ' +
          'widget extracted from the SDK.',
      ),
    );
  });

  test('an unknown prop is a numbered error with the widget named', () => {
    expect(
      lowerFirst(
        "import { Center } from 'flutter-tsx';\n" +
          'export const Probe = () => <Center whirl={1} />;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0202 probe.tsx:2:36 — <Center> has no prop `whirl`. Check the ' +
          'API reference for the available props.',
      ),
    );
  });
});
