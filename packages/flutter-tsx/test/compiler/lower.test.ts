import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import type { ApiSnapshot, ParamModel } from '@src/api/model';
import { analyzeSource } from '@src/compiler/analyze';
import type { IrComponent, IrStore } from '@src/compiler/ir';
import {
  buildCompileContext,
  buildUserWidgets,
  type CompileContext,
  lowerComponent,
  lowerStore,
} from '@src/compiler/lower';
import { deriveSlots } from '@src/derive/slots';
import { loadPluginApi } from '@src/plugins/api';
import { deriveHooks } from '@src/plugins/hooks';
import { PLUGIN_OVERRIDES } from '@src/plugins/overrides';

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

const cameraHooksContext = async (
  base: CompileContext,
): Promise<CompileContext> => {
  const api = await loadPluginApi('camera');
  const [hook] = deriveHooks(api, PLUGIN_OVERRIDES.camera);
  if (hook === undefined) {
    throw new Error('expected the derived useCamera hook');
  }
  const controller = api.classes.find(
    (entity) => entity.name === 'CameraController',
  );
  return {
    ...base,
    pluginHooks: new Map([
      [
        'useCamera',
        {
          hook,
          methods: new Map(
            controller?.methods.map((method) => [method.name, method]) ?? [],
          ),
          fields: new Map(
            controller?.fields.map((field) => [field.name, field.type]) ?? [],
          ),
        },
      ],
    ]),
  };
};

describe('lowerComponent — camera fixture', () => {
  test('produces the complete IR', async () => {
    const source = await Bun.file(fixturePath).text();
    const analysis = analyzeSource(source, 'input.tsx');
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected the camera component');
    }
    const ir = lowerComponent(
      component,
      await cameraHooksContext(await contextOnce()),
    );

    expect(ir.name).toBe('CameraScreen');
    expect(ir.kind).toBe('stateful');
    expect(ir.body).toEqual({
      name: 'Column',
      constConstructor: true,
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
                      constConstructor: true,
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
                    constConstructor: true,
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
                            constConstructor: true,
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
      constConstructor: true,
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
                    constConstructor: true,
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
                            constConstructor: true,
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
                  constConstructor: true,
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
              value: {
                kind: 'widget',
                widget: {
                  name: 'Text',
                  constConstructor: true,
                  args: [
                    {
                      param: 'data',
                      positional: true,
                      value: { kind: 'dartExpr', dart: '_label' },
                    },
                  ],
                },
              },
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
    expect(kinds).toEqual(['widget', 'widget', 'widget']);

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

describe('lowerComponent — value forms', () => {
  const constructOf = async (
    source: string,
    param: string,
  ): Promise<unknown> => {
    const ir = await lowerFirst(source, 'probe.tsx');
    return ir.body.args.find((argument) => argument.param === param)?.value;
  };

  test('#RGB hex colors expand digit pairs', async () => {
    expect(
      await constructOf(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color="#abc"><Text>hi</Text></Container>;\n',
        'color',
      ),
    ).toEqual({
      kind: 'construct',
      className: 'Color',
      constructorName: '',
      args: [
        {
          param: 'value',
          positional: true,
          value: { kind: 'number', value: '0xFFAABBCC' },
        },
      ],
    });
  });

  test('#RRGGBBAA hex colors move alpha to the front', async () => {
    expect(
      await constructOf(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color="#7B1FA280"><Text>hi</Text></Container>;\n',
        'color',
      ),
    ).toEqual({
      kind: 'construct',
      className: 'Color',
      constructorName: '',
      args: [
        {
          param: 'value',
          positional: true,
          value: { kind: 'number', value: '0x807B1FA2' },
        },
      ],
    });
  });

  test('shorthand object properties lower their identifier', async () => {
    const ir = await lowerFirst(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const fontSize = 18;\n' +
        '  return <Text style={{ fontSize }}>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const style = ir.body.args.find(
      (argument) => argument.param === 'style',
    )?.value;

    if (style?.kind !== 'construct') {
      throw new Error('expected a construct');
    }
    expect(style.args.map((argument) => argument.value.kind)).toEqual(['raw']);
  });

  test('member access on unknown owners stays raw', async () => {
    const ir = await lowerFirst(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const config = { factor: 2 };\n' +
        '  return <Text textScaleFactor={config.factor}>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(
      ir.body.args.find((argument) => argument.param === 'textScaleFactor')
        ?.value.kind,
    ).toBe('raw');
  });

  test('a string that fits no value form is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text textScaleFactor="big">hi</Text>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:50 — `big` cannot express a double value.',
      ),
    );
  });

  test('an unknown color name is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color="blurple"><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:45 — `blurple` cannot express a Color value.',
      ),
    );
  });

  test('a malformed hex color is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color="#12"><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:45 — `#12` is not a hex color — use #RGB, ' +
          '#RRGGBB, or #RRGGBBAA.',
      ),
    );
  });

  test('a number that fits no value form is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color={5}><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error('TSX0205 probe.tsx:2:46 — `5` cannot express a Color value.'),
    );
  });

  test('a boolean on a non-bool prop is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container color><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:39 — `true` cannot express a Color value.',
      ),
    );
  });

  test('mixed edge-inset keys are a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container padding={{ top: 1, horizontal: 2 }}><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0206 probe.tsx:2:48 — edge insets take `{horizontal?, ' +
          'vertical?}` or `{left?, top?, right?, bottom?}` (numbers).',
      ),
    );
  });

  test('spread properties in object values are a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const base = { top: 1 };\n' +
          '  return <Container padding={{ ...base }}><Text>hi</Text></Container>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0206 probe.tsx:4:32 — object values must use plain ' +
          '`key: value` properties.',
      ),
    );
  });

  test('an unknown constructible property is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text style={{ glow: 1 }}>hi</Text>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0207 probe.tsx:2:43 — TextStyle has no `glow` property. Check ' +
          'the API reference for the available properties.',
      ),
    );
  });

  test('an object literal on a non-constructible class is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Container, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Container transform={{}}><Text>hi</Text></Container>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:50 — an object literal cannot express a ' +
          'Matrix4 value.',
      ),
    );
  });

  test('inline handler bodies lower to closures with setter statements', async () => {
    const ir = await lowerFirst(
      "import { ElevatedButton, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        '  return (\n' +
        '    <ElevatedButton onClick={() => setCount(count + 1)}>Go</ElevatedButton>\n' +
        '  );\n' +
        '};\n',
      'probe.tsx',
    );

    expect(
      ir.body.args.find((argument) => argument.param === 'onPressed')?.value,
    ).toEqual({
      kind: 'closure',
      params: [],
      statements: [{ kind: 'setState', assignments: ['_count++'] }],
    });
  });

  test('an unsupported inline handler statement is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Switch, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [on, setOn] = useState(false);\n' +
          '  return <Switch value={on} onChanged={() => { console.log(1); }} />;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:4:48 — this statement is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('a function on a non-function prop is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text maxLines={() => {}}>hi</Text>;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:44 — a function cannot express an int value.',
      ),
    );
  });

  test('an object literal on a widget prop is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Center } from 'flutter-tsx';\n" +
          'export const Probe = () => <Center child={{}} />;\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0205 probe.tsx:2:43 — an object literal cannot express a ' +
          'widget value.',
      ),
    );
  });
});

describe('lowerComponent — stateful pieces', () => {
  test('states become private fields, setters become setState methods', async () => {
    const ir = await lowerFirst(
      "import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        "  const [label, setLabel] = useState('x');\n" +
        '  const bump = () => {\n' +
        '    setCount(count + 1);\n' +
        "    setLabel('bumped');\n" +
        '  };\n' +
        '  const reset = () => setCount(0);\n' +
        '  const grow = () => {\n' +
        '    setCount(count + 5);\n' +
        '  };\n' +
        '  const drop = () => setCount(count - 1);\n' +
        '  const shrink = () => setCount(count - 5);\n' +
        '  const twice = () => setCount(count * 2);\n' +
        '  return <Column><Text>hi</Text></Column>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(ir.kind).toBe('stateful');
    expect(ir.fields).toEqual([
      { name: '_count', dartType: 'int', mutable: true, initializer: '0' },
      {
        name: '_label',
        dartType: 'String',
        mutable: true,
        initializer: "'x'",
      },
    ]);
    expect(ir.methods).toEqual([
      {
        name: 'bump',
        isAsync: false,
        statements: [
          {
            kind: 'setState',
            assignments: ['_count++', "_label = 'bumped'"],
          },
        ],
      },
      {
        name: 'reset',
        isAsync: false,
        statements: [{ kind: 'setState', assignments: ['_count = 0'] }],
      },
      {
        name: 'grow',
        isAsync: false,
        statements: [{ kind: 'setState', assignments: ['_count += 5'] }],
      },
      {
        name: 'drop',
        isAsync: false,
        statements: [{ kind: 'setState', assignments: ['_count--'] }],
      },
      {
        name: 'shrink',
        isAsync: false,
        statements: [{ kind: 'setState', assignments: ['_count -= 5'] }],
      },
      {
        name: 'twice',
        isAsync: false,
        statements: [
          { kind: 'setState', assignments: ['_count = _count * 2'] },
        ],
      },
    ]);
  });

  test('text slots interpolate expressions between text runs', async () => {
    const ir = await lowerFirst(
      "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        '  return <Text>Count: {count}!</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(ir.body.args).toEqual([
      {
        param: 'data',
        positional: true,
        value: {
          kind: 'interpolation',
          parts: [
            { kind: 'text', value: 'Count: ' },
            { kind: 'expr', value: '_count' },
            { kind: 'text', value: '!' },
          ],
        },
      },
    ]);
  });

  test('scalar children wrap in Text: interpolated unless a string state', async () => {
    const ir = await lowerFirst(
      "import { Column, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        "  const [label, setLabel] = useState('x');\n" +
        '  return (\n' +
        '    <Column>\n' +
        '      {count}\n' +
        '      {label}\n' +
        "      {'plain'}\n" +
        '    </Column>\n' +
        '  );\n' +
        '};\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    const textArgs = children.value.items.map((item) => {
      if (item.kind !== 'value' || item.value.kind !== 'widget') {
        throw new Error('expected Text widgets');
      }
      return item.value.widget.args[0]?.value;
    });
    expect(textArgs).toEqual([
      {
        kind: 'interpolation',
        parts: [{ kind: 'expr', value: '_count' }],
      },
      { kind: 'dartExpr', dart: '_label' },
      { kind: 'string', value: 'plain' },
    ]);
  });

  test('a setter call without an argument is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  const boom = () => setCount();\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:4:22 — this statement is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('a handler statement beyond state setters is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  const boom = () => {\n' +
          '    console.log(count);\n' +
          '  };\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:5:5 — this statement is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });
});

describe('lowerComponent — effects and conditionals', () => {
  test('mount effects lower to initState statements', async () => {
    const ir = await lowerFirst(
      "import { Text, useEffect, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [online, setOnline] = useState(false);\n' +
        '  const [checks, setChecks] = useState(0);\n' +
        '  useEffect(() => {\n' +
        '    setOnline(true);\n' +
        '    setChecks(1);\n' +
        '  }, []);\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );

    expect(ir.initStatements).toEqual([
      {
        kind: 'setState',
        assignments: ['_online = true', '_checks = 1'],
      },
    ]);
  });

  test('ternary children lower to conditional widgets', async () => {
    const ir = await lowerFirst(
      "import { Column, Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [on, setOn] = useState(false);\n' +
        '  return <Column>{on ? <Text>Yes</Text> : <Text>No</Text>}</Column>;\n' +
        '};\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    const [item] = children.value.items;
    if (item?.kind !== 'value') {
      throw new Error('expected a value item');
    }
    expect(item.value.kind).toBe('conditional');
    if (item.value.kind !== 'conditional') {
      throw new Error('narrow');
    }
    expect(item.value.condition).toEqual({ kind: 'stateRef', name: 'on' });
    expect(item.value.whenTrue.kind).toBe('widget');
    expect(item.value.whenFalse.kind).toBe('widget');
  });

  test('effects with dependencies are a numbered error', () => {
    expect(
      lowerFirst(
        "import { Text, useEffect, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [n, setN] = useState(0);\n' +
          '  useEffect(() => {\n' +
          '    setN(1);\n' +
          '  }, [n]);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0306 probe.tsx:4:3 — only mount effects compile: pass an empty ' +
          'dependency array (`useEffect(() => { ... }, [])`).',
      ),
    );
  });

  test('effect cleanups are a numbered error until plugin controllers', () => {
    expect(
      lowerFirst(
        "import { Text, useEffect, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [n, setN] = useState(0);\n' +
          '  useEffect(() => {\n' +
          '    setN(1);\n' +
          '    return () => setN(0);\n' +
          '  }, []);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0307 probe.tsx:6:5 — effect cleanups land with plugin ' +
          'controllers (roadmap step 22).',
      ),
    );
  });
});

describe('lowerComponent — list rendering', () => {
  test('.map() children lower to for items with typed loop locals', async () => {
    const ir = await lowerFirst(
      "import { Column, Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [items, setItems] = useState(['a']);\n" +
        '  return <Column>{items.map((item) => <Text>{item}</Text>)}</Column>;\n' +
        '};\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    expect(children.value.items).toEqual([
      {
        kind: 'for',
        itemName: 'item',
        iterable: { kind: 'stateRef', name: 'items' },
        child: {
          kind: 'value',
          value: {
            kind: 'widget',
            widget: {
              name: 'Text',
              constConstructor: true,
              args: [
                {
                  param: 'data',
                  positional: true,
                  value: { kind: 'dartExpr', dart: 'item' },
                },
              ],
            },
          },
        },
      },
    ]);
  });

  test('array-literal iterables lower with a translated iterable', async () => {
    const ir = await lowerFirst(
      "import { Column, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        "  <Column>{['a', 'b'].map((item) => <Text>{item}</Text>)}</Column>\n" +
        ');\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    const [item] = children.value.items;
    if (item?.kind !== 'for') {
      throw new Error('expected a for item');
    }
    expect(item.iterable).toEqual({ kind: 'dartExpr', dart: "['a', 'b']" });
  });

  test('a .map() with a block body is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Column, Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          "  const [items, setItems] = useState(['a']);\n" +
          '  return <Column>{items.map((item) => { return <Text>{item}</Text>; })}</Column>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:4:19 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('a non-map call child is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Column, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          "  const [items, setItems] = useState(['a']);\n" +
          '  return <Column>{items.slice(1)}</Column>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:4:19 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('a .map() with an index parameter is a numbered error', () => {
    expect(
      lowerFirst(
        "import { Column, Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          "  const [items, setItems] = useState(['a']);\n" +
          '  return <Column>{items.map((item, index) => <Text>{item}</Text>)}</Column>;\n' +
          '};\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:4:19 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });
});

describe('lowerComponent — composition', () => {
  test('string props print plain; children on a user component error', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'const Chip = ({ label }: { label: string }) => <Text>{label}</Text>;\n' +
        'export const Probe = () => <Chip label="hi" />;\n',
      'probe.tsx',
    );
    const compile = await contextOnce();
    const chip = analysis.components[0];
    if (chip === undefined) {
      throw new Error('expected the Chip component');
    }
    const ir = lowerComponent(chip, {
      ...compile,
      userWidgets: buildUserWidgets(analysis.components),
    });

    expect(ir.body).toEqual({
      name: 'Text',
      constConstructor: true,
      args: [
        {
          param: 'data',
          positional: true,
          value: { kind: 'dartExpr', dart: 'label' },
        },
      ],
    });
  });
});

describe('lowerComponent — fragments and typed text slots', () => {
  test('fragment children splice into the parent list', async () => {
    const ir = await lowerFirst(
      "import { Column, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Column>\n' +
        '    <Text>first</Text>\n' +
        '    <>\n' +
        '      <Text>second</Text>\n' +
        '      <Text>third</Text>\n' +
        '    </>\n' +
        '  </Column>\n' +
        ');\n',
      'probe.tsx',
    );

    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    expect(children.value.items).toHaveLength(3);
  });

  test('a fragment root wraps in a Column (vision rule 4)', async () => {
    const ir = await lowerFirst(
      "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <>\n' +
        '    <Text>one</Text>\n' +
        '    <Text>two</Text>\n' +
        '  </>\n' +
        ');\n',
      'probe.tsx',
    );

    expect(ir.body.name).toBe('Column');
    const [children] = ir.body.args;
    if (children?.value.kind !== 'widgetList') {
      throw new Error('expected a children list');
    }
    expect(children.value.items).toHaveLength(2);
  });

  test('string-typed ternary text slots print plain, not interpolated', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        'const Chip = ({ label, hot }: { label: string; hot: boolean }) => (\n' +
        '  <Text>{hot ? `* ${label}` : label}</Text>\n' +
        ');\n' +
        'export const Probe = () => <Chip label="hi" hot={true} />;\n',
      'probe.tsx',
    );
    const compile = await contextOnce();
    const chip = analysis.components[0];
    if (chip === undefined) {
      throw new Error('expected the Chip component');
    }
    const ir = lowerComponent(chip, {
      ...compile,
      userWidgets: buildUserWidgets(analysis.components),
    });

    expect(ir.body.args).toEqual([
      {
        param: 'data',
        positional: true,
        value: { kind: 'dartExpr', dart: "hot ? '* $label' : label" },
      },
    ]);
  });
});

describe('lowerComponent — plugin hooks', () => {
  const cameraContext = async (): Promise<CompileContext> =>
    cameraHooksContext(await contextOnce());

  test('the camera fixture lowers to the full stateful plugin IR', async () => {
    const source = await Bun.file(fixturePath).text();
    const analysis = analyzeSource(source, 'input.tsx');
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected the camera component');
    }
    const ir = lowerComponent(component, await cameraContext());

    expect(ir.fields).toEqual([
      {
        name: '_cam',
        dartType: 'CameraController?',
        mutable: true,
        initializer: null,
      },
      { name: '_taken', dartType: 'bool', mutable: true, initializer: 'false' },
    ]);
    expect(ir.setupMethods).toEqual([
      {
        name: 'initCam',
        lines: [
          'final cameras = await availableCameras();',
          'final controller = CameraController(cameras.first, ResolutionPreset.high);',
          'await controller.initialize();',
          'if (!mounted) {',
          '  await controller.dispose();',
          '  return;',
          '}',
          'setState(() {',
          '  _cam = controller;',
          '});',
        ],
      },
    ]);
    expect(ir.initStatements).toEqual([{ kind: 'dart', line: '_initCam();' }]);
    expect(ir.disposeLines).toEqual(['_cam?.dispose();']);
    expect(ir.methods).toEqual([
      {
        name: 'takePhoto',
        isAsync: true,
        statements: [
          { kind: 'dart', line: 'await _cam?.takePicture();' },
          { kind: 'setState', assignments: ['_taken = true'] },
        ],
      },
    ]);
    expect(ir.pluginImports).toEqual(['package:camera/camera.dart']);
  });

  test('non-available suppliers name their local after the param type', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { useEngine } from 'plugin:motors';\n" +
        'export const Probe = () => {\n' +
        '  const engine = useEngine();\n' +
        '  const rev = () => {\n' +
        '    engine.start(3);\n' +
        '  };\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, {
      ...(await contextOnce()),
      pluginHooks: new Map([
        [
          'useEngine',
          {
            hook: {
              hookName: 'useEngine',
              className: 'EngineController',
              dartImport: 'package:motors/motors.dart',
              acquisition: { kind: 'constructor' },
              construct: [
                {
                  kind: 'supplierFirst',
                  functionName: 'listEngines',
                  paramName: 'engine',
                  filters: [],
                  paramType: 'Engine',
                },
              ],
              managed: ['initialize', 'dispose'],
              options: [],
            },
            fields: new Map(),
            methods: new Map(
              ['initialize', 'dispose', 'start'].map((name) => [
                name,
                {
                  name,
                  doc: '',
                  isStatic: false,
                  returnType: { kind: 'void' },
                  params: [],
                },
              ]),
            ),
          },
        ],
      ]),
    });

    expect(ir.setupMethods[0]?.lines.slice(0, 2)).toEqual([
      'final engines = await listEngines();',
      'final controller = EngineController(engines.first);',
    ]);
    expect(ir.methods).toEqual([
      {
        name: 'rev',
        isAsync: false,
        statements: [{ kind: 'dart', line: '_engine?.start(3);' }],
      },
    ]);
  });

  test('hook options select enum members and wrap long construct lines', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { useCamera } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        "  const cam = useCamera({ resolution: 'veryHigh' });\n" +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(
      component,
      await cameraHooksContext(await contextOnce()),
    );

    expect(ir.setupMethods[0]?.lines.slice(0, 5)).toEqual([
      'final cameras = await availableCameras();',
      'final controller = CameraController(',
      '  cameras.first,',
      '  ResolutionPreset.veryHigh,',
      ');',
    ]);
  });

  test('a supplier filter selects by field with a first fallback', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { useCamera } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        "  const cam = useCamera({ lens: 'front' });\n" +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(
      component,
      await cameraHooksContext(await contextOnce()),
    );

    expect(ir.setupMethods[0]?.lines.slice(0, 7)).toEqual([
      'final cameras = await availableCameras();',
      'final description = cameras.firstWhere(',
      '  (candidate) => candidate.lensDirection == CameraLensDirection.front,',
      '  orElse: () => cameras.first,',
      ');',
      'final controller = CameraController(description, ResolutionPreset.high);',
      'await controller.initialize();',
    ]);
  });

  test('two supplier filters combine into one predicate', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { useCamera } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        "  const cam = useCamera({ lens: 'back', lensType: 'wide' });\n" +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(
      component,
      await cameraHooksContext(await contextOnce()),
    );

    expect(ir.setupMethods[0]?.lines.slice(0, 6)).toEqual([
      'final cameras = await availableCameras();',
      'final description = cameras.firstWhere(',
      '  (candidate) =>',
      '      candidate.lensDirection == CameraLensDirection.back &&',
      '      candidate.lensType == CameraLensType.wide,',
      '  orElse: () => cameras.first,',
    ]);
  });

  test('an invalid option member is a numbered error', () => {
    const probe = async (): Promise<unknown> => {
      const analysis = analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          "import { useCamera } from 'plugin:camera';\n" +
          'export const Probe = () => {\n' +
          "  const cam = useCamera({ resolution: 'grainy' });\n" +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      );
      const [component] = analysis.components;
      if (component === undefined) {
        throw new Error('expected a component');
      }
      return lowerComponent(
        component,
        await cameraHooksContext(await contextOnce()),
      );
    };

    expect(probe()).rejects.toThrow(
      new Error(
        'TSX0203 probe.tsx:4:27 — `grainy` is not a ResolutionPreset member.',
      ),
    );
  });

  test('a non-literal options argument is a numbered error', () => {
    const probe = async (): Promise<unknown> => {
      const analysis = analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          "import { useCamera } from 'plugin:camera';\n" +
          'export const Probe = () => {\n' +
          "  const settings = { resolution: 'high' };\n" +
          '  const cam = useCamera(settings);\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      );
      const [component] = analysis.components;
      if (component === undefined) {
        throw new Error('expected a component');
      }
      return lowerComponent(
        component,
        await cameraHooksContext(await contextOnce()),
      );
    };

    expect(probe()).rejects.toThrow(
      new Error(
        'TSX0206 probe.tsx:5:25 — object values must use plain ' +
          '`key: value` properties.',
      ),
    );
  });

  test('an unknown hook option is a numbered error', () => {
    const probe = async (): Promise<unknown> => {
      const analysis = analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          "import { useCamera } from 'plugin:camera';\n" +
          'export const Probe = () => {\n' +
          "  const cam = useCamera({ zoom: 'in' });\n" +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      );
      const [component] = analysis.components;
      if (component === undefined) {
        throw new Error('expected a component');
      }
      return lowerComponent(
        component,
        await cameraHooksContext(await contextOnce()),
      );
    };

    expect(probe()).rejects.toThrow(
      new Error('TSX0313 probe.tsx:4:27 — useCamera has no option `zoom`.'),
    );
  });

  const storageContext = async (): Promise<CompileContext> => {
    const api = await loadPluginApi('flutter_secure_storage');
    const [hook] = deriveHooks(api, undefined);
    if (hook === undefined) {
      throw new Error('expected the derived useSecureStorage hook');
    }
    const storage = api.classes.find(
      (entity) => entity.name === 'FlutterSecureStorage',
    );
    return {
      ...(await contextOnce()),
      pluginHooks: new Map([
        [
          'useSecureStorage',
          {
            hook,
            methods: new Map(
              storage?.methods.map((method) => [method.name, method]) ?? [],
            ),
            fields: new Map(
              storage?.fields.map((field) => [field.name, field.type]) ?? [],
            ),
          },
        ],
      ]),
    };
  };

  test('const-field services skip lifecycle and call with named args', async () => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
        'export const Probe = () => {\n' +
        '  const storage = useSecureStorage();\n' +
        '  const [saved, setSaved] = useState(false);\n' +
        '  const save = async () => {\n' +
        "    await storage.write({ key: 'token', value: 'secret' });\n" +
        '    setSaved(true);\n' +
        '  };\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await storageContext());

    expect(ir.fields[0]).toEqual({
      name: '_storage',
      dartType: 'FlutterSecureStorage',
      mutable: false,
      initializer: 'const FlutterSecureStorage()',
    });
    expect(ir.setupMethods).toEqual([]);
    expect(ir.initStatements).toEqual([]);
    expect(ir.disposeLines).toEqual([]);
    expect(ir.methods[0]?.statements[0]).toEqual({
      kind: 'dart',
      line: "await _storage.write(key: 'token', value: 'secret');",
    });
  });

  test('an unknown named argument is a numbered error', () => {
    const probe = async (): Promise<unknown> => {
      const analysis = analyzeSource(
        "import { Text } from 'flutter-tsx';\n" +
          "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
          'export const Probe = () => {\n' +
          '  const storage = useSecureStorage();\n' +
          '  const boom = async () => {\n' +
          "    await storage.write({ key: 'token', vault: 'x' });\n" +
          '  };\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        'probe.tsx',
      );
      const [component] = analysis.components;
      if (component === undefined) {
        throw new Error('expected a component');
      }
      return lowerComponent(component, await storageContext());
    };

    expect(probe()).rejects.toThrow(
      new Error(
        'TSX0314 probe.tsx:6:41 — `write` has no named argument `vault`. ' +
          'Check the API reference for the available arguments.',
      ),
    );
  });

  test('an unknown plugin method is a numbered error', async () => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        "import { useCamera } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        '  const cam = useCamera();\n' +
        '  const boom = () => {\n' +
        '    cam.levitate();\n' +
        '  };\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const context = await cameraContext();

    expect(() => lowerComponent(component, context)).toThrow(
      new Error(
        'TSX0312 probe.tsx:6:5 — CameraController has no method ' +
          '`levitate`. Check the API reference for the available methods.',
      ),
    );
  });

  test('an unavailable hook is a numbered error', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { useTeleport } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        '  const beam = useTeleport();\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const context = await cameraContext();

    expect(() => lowerComponent(component, context)).toThrow(
      new Error(
        'TSX0311 probe.tsx:4:16 — plugin:camera derives no `useTeleport` ' +
          'hook.',
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

  test('whitespace-only children on a slotless widget are fine', async () => {
    const ir = await lowerFirst(
      "import { Scaffold, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Scaffold body={<Text>hi</Text>}>\n' +
        '  </Scaffold>\n' +
        ');\n',
      'probe.tsx',
    );

    expect(ir.body.args.map((argument) => argument.param)).toEqual(['body']);
  });

  test('children on a widget without a children slot are a numbered error', () => {
    expect(
      lowerFirst(
        "import { Scaffold, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Scaffold>\n' +
          '    <Text>lost</Text>\n' +
          '  </Scaffold>\n' +
          ');\n',
        'probe.tsx',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0208 probe.tsx:4:5 — <Scaffold> takes no children — check its ' +
          'named slots in the API reference.',
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
describe('lowerComponent — plugin functions', () => {
  const launcherContext = async (): Promise<CompileContext> => {
    const api = await loadPluginApi('url_launcher');
    const launchUrl = api.functions.find(
      (candidate) => candidate.name === 'launchUrl',
    );
    if (launchUrl === undefined) {
      throw new Error('expected the extracted launchUrl function');
    }
    return {
      ...(await contextOnce()),
      pluginFunctions: new Map([
        [
          'launchUrl',
          {
            fn: launchUrl,
            dartImport: 'package:url_launcher/url_launcher.dart',
          },
        ],
      ]),
      pluginEnums: new Map(
        api.enums.map((entity) => [entity.name, new Set(entity.values)]),
      ),
    };
  };

  const lowerProbe = async (callLine: string): Promise<IrComponent> => {
    const analysis = analyzeSource(
      "import { Text, useState } from 'flutter-tsx';\n" +
        "import { launchUrl } from 'plugin:url_launcher';\n" +
        'export const Probe = () => {\n' +
        '  const [opened, setOpened] = useState(false);\n' +
        '  const open = async () => {\n' +
        `    ${callLine}\n` +
        '    setOpened(true);\n' +
        '  };\n' +
        '  return <Text>hi</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    return lowerComponent(component, await launcherContext());
  };

  test('function calls wrap Uri arguments and record the import', async () => {
    const ir = await lowerProbe("await launchUrl('https://flutter.dev');");

    expect(ir.methods[0]?.statements[0]).toEqual({
      kind: 'dart',
      line: "await launchUrl(Uri.parse('https://flutter.dev'));",
    });
    expect(ir.pluginImports).toEqual([
      'package:url_launcher/url_launcher.dart',
    ]);
  });

  test('named arguments translate plugin enum values', async () => {
    const ir = await lowerProbe(
      "await launchUrl('https://flutter.dev', { mode: 'externalApplication' });",
    );

    expect(ir.methods[0]?.statements[0]).toEqual({
      kind: 'dart',
      line:
        'await launchUrl(\n' +
        "  Uri.parse('https://flutter.dev'),\n" +
        '  mode: LaunchMode.externalApplication,\n' +
        ');',
    });
  });

  test('an unknown named argument is a numbered error', () => {
    expect(
      lowerProbe("await launchUrl('https://flutter.dev', { modee: 'x' });"),
    ).rejects.toThrow(
      new Error(
        'TSX0314 probe.tsx:6:46 — `launchUrl` has no named argument ' +
          '`modee`. Check the API reference for the available arguments.',
      ),
    );
  });

  test('a bare expression statement in a handler is a numbered error', () => {
    expect(lowerProbe('opened;')).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:6:5 — this statement is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('a nested member call in a handler is a numbered error', () => {
    expect(lowerProbe('window.history.back();')).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:6:5 — this statement is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('an unknown plugin enum value is a numbered error', () => {
    expect(
      lowerProbe("await launchUrl('https://flutter.dev', { mode: 'nope' });"),
    ).rejects.toThrow(
      new Error('TSX0203 probe.tsx:6:52 — `nope` is not a LaunchMode member.'),
    );
  });
});
describe('lowerComponent — plugin property reads', () => {
  const infoContext = async (): Promise<CompileContext> => {
    const api = await loadPluginApi('package_info_plus');
    const [hook] = deriveHooks(api, undefined);
    if (hook === undefined) {
      throw new Error('expected the derived usePackageInfo hook');
    }
    const packageInfo = api.classes.find(
      (entity) => entity.name === 'PackageInfo',
    );
    return {
      ...(await contextOnce()),
      pluginHooks: new Map([
        [
          'usePackageInfo',
          {
            hook,
            methods: new Map(
              packageInfo?.methods.map((method) => [method.name, method]) ?? [],
            ),
            fields: new Map(
              packageInfo?.fields.map((field) => [field.name, field.type]) ??
                [],
            ),
          },
        ],
      ]),
    };
  };

  test('a String property renders as a raw text argument', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { usePackageInfo } from 'plugin:package_info_plus';\n" +
        'export const Probe = () => {\n' +
        '  const info = usePackageInfo();\n' +
        '  return <Text>{info.appName}</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await infoContext());

    expect(ir.body.args[0]?.value).toEqual({
      kind: 'dartExpr',
      dart: "_info?.appName ?? ''",
    });
  });

  test('a String property interpolates alongside text', async () => {
    const analysis = analyzeSource(
      "import { Text } from 'flutter-tsx';\n" +
        "import { usePackageInfo } from 'plugin:package_info_plus';\n" +
        'export const Probe = () => {\n' +
        '  const info = usePackageInfo();\n' +
        '  return <Text>v{info.version}</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await infoContext());

    expect(ir.body.args[0]?.value).toEqual({
      kind: 'interpolation',
      parts: [
        { kind: 'text', value: 'v' },
        { kind: 'expr', value: "_info?.version ?? ''" },
      ],
    });
  });
});
describe('lowerComponent — assert-implied requirements', () => {
  test('an unsatisfied one-of group is a numbered error', async () => {
    const analysis = analyzeSource(
      "import { Text, Tooltip } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Tooltip>\n' +
        '    <Text>Content</Text>\n' +
        '  </Tooltip>\n' +
        ');\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }

    let message = '';
    try {
      lowerComponent(component, await contextOnce());
    } catch (error) {
      ({ message } = error as Error);
    }
    expect(message).toBe(
      'TSX0317 probe.tsx:3:4 — `Tooltip` needs one of `message` or ' +
        '`richMessage`: Flutter asserts it at runtime, so leaving all of ' +
        'them out compiles to Dart that throws.',
    );
  });

  test('satisfying the group compiles', async () => {
    const analysis = analyzeSource(
      "import { Text, Tooltip } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Tooltip message="Save">\n' +
        '    <Text>Content</Text>\n' +
        '  </Tooltip>\n' +
        ');\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const ir = lowerComponent(component, await contextOnce());

    expect(ir.body.args.map((argument) => argument.param)).toEqual([
      'message',
      'child',
    ]);
  });

  test('a four-way group lists every alternative', async () => {
    const analysis = analyzeSource(
      "import { CupertinoActionSheet } from 'flutter-tsx';\n" +
        'export const Probe = () => <CupertinoActionSheet />;\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    let message = '';
    try {
      lowerComponent(component, await contextOnce());
    } catch (error) {
      ({ message } = error as Error);
    }
    expect(message).toBe(
      'TSX0317 probe.tsx:2:29 — `CupertinoActionSheet` needs one of ' +
        '`actions`, `title`, `message` or `cancelButton`: Flutter asserts ' +
        'it at runtime, so leaving all of them out compiles to Dart that ' +
        'throws.',
    );
  });
});
// Gesture props are the vision's GestureDetector replacement: any widget can
// take them, and the compiler wraps. The allowed set is derived from
// GestureDetector's own constructor — no hand-maintained list.
describe('lowerComponent — gesture props', () => {
  const lowerProbe = async (element: string): Promise<IrComponent> => {
    const analysis = analyzeSource(
      "import { Container, Text, ListTile, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [hit, setHit] = useState(false);\n' +
        '  const tap = () => {\n' +
        '    setHit(true);\n' +
        '  };\n' +
        `  return ${element};\n` +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    return lowerComponent(component, await contextOnce());
  };

  test('a tap prop wraps the widget in a GestureDetector', async () => {
    const ir = await lowerProbe(
      '<Container onClick={tap}><Text>Hi</Text></Container>',
    );

    expect(ir.body.name).toBe('GestureDetector');
    expect(ir.body.args.map((argument) => argument.param)).toEqual([
      'onTap',
      'child',
    ]);
    expect(ir.body.args[0]?.value).toEqual({
      kind: 'handlerRef',
      name: 'tap',
    });
    const [, child] = ir.body.args;
    expect(child?.value.kind).toBe('widget');
  });

  test('several gesture props land on one wrapper', async () => {
    const ir = await lowerProbe(
      '<Container onClick={tap} onLongPress={tap} onDoubleTap={tap}>' +
        '<Text>Hi</Text></Container>',
    );

    expect(ir.body.name).toBe('GestureDetector');
    expect(ir.body.args.map((argument) => argument.param)).toEqual([
      'onTap',
      'onLongPress',
      'onDoubleTap',
      'child',
    ]);
  });

  test("a widget's own prop of that name is not wrapped", async () => {
    const ir = await lowerProbe('<ListTile onClick={tap} />');

    expect(ir.body.name).toBe('ListTile');
    expect(ir.body.args.map((argument) => argument.param)).toEqual(['onTap']);
  });

  test('an unknown prop that is no gesture is still a numbered error', () => {
    expect(lowerProbe('<Container onWiggle={tap} />')).rejects.toThrow(
      new Error(
        'TSX0202 probe.tsx:7:21 — <Container> has no prop `onWiggle`. ' +
          'Check the API reference for the available props.',
      ),
    );
  });
});
// The gesture derivation reads GestureDetector out of the snapshot, so each
// rule is pinned against a synthetic detector rather than only the SDK one.
describe('buildCompileContext — gesture derivation rules', () => {
  const detectorSnapshot = (params: ParamModel[]): ApiSnapshot => ({
    meta: {
      frameworkVersion: '3.47.1',
      dartSdkVersion: '3.13.1',
      frameworkRevision: 'test',
    },
    entities: [
      {
        kind: 'widget',
        name: 'GestureDetector',
        library: 'widgets',
        doc: '',
        supertypes: ['StatelessWidget', 'Widget'],
        constructors: [
          {
            name: '',
            doc: '',
            isConst: true,
            paramMemberAsserts: false,
            requiredOneOf: [],
            params: [
              {
                name: 'child',
                type: { kind: 'nullable', inner: { kind: 'widget' } },
                display: 'Widget?',
                named: true,
                required: false,
                defaultValue: null,
                doc: '',
                deprecated: false,
              },
              ...params,
            ],
          },
        ],
        constants: [],
      },
    ],
    hierarchy: { GestureDetector: ['StatelessWidget', 'Widget'] },
    exports: {},
  });

  const callback = (name: string, nullable: boolean): ParamModel => {
    const fn = {
      kind: 'function' as const,
      returnType: { kind: 'void' as const },
      params: [],
    };
    return {
      name,
      type: nullable ? { kind: 'nullable', inner: fn } : fn,
      display: 'VoidCallback',
      named: true,
      required: false,
      defaultValue: null,
      doc: '',
      deprecated: false,
    };
  };

  test('a non-nullable callback param is still a gesture prop', () => {
    const snapshot = detectorSnapshot([callback('onTap', false)]);
    const built = buildCompileContext(snapshot, deriveSlots(snapshot));

    expect([...(built.gestures?.props.keys() ?? [])]).toEqual(['onClick']);
    expect(built.gestures?.childParam).toBe('child');
  });

  test('a snapshot without GestureDetector derives no gestures', () => {
    const snapshot = detectorSnapshot([]);
    const withoutDetector: ApiSnapshot = {
      ...snapshot,
      entities: [],
      hierarchy: {},
    };
    const built = buildCompileContext(
      withoutDetector,
      deriveSlots(withoutDetector),
    );

    expect(built.gestures).toBeNull();
  });

  test('a detector with no callbacks yields no gesture wrapping', () => {
    const snapshot = detectorSnapshot([]);
    const built = buildCompileContext(snapshot, deriveSlots(snapshot));

    expect(built.gestures).toBeNull();
  });

  test('without gestures derived, an on-prop is a plain unknown prop', () => {
    const snapshot = detectorSnapshot([]);
    const built = buildCompileContext(snapshot, deriveSlots(snapshot));
    const analysis = analyzeSource(
      "import { GestureDetector } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const tap = () => {};\n' +
        '  return <GestureDetector onClick={tap} />;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }

    expect(() => lowerComponent(component, built)).toThrow(
      new Error(
        'TSX0202 probe.tsx:4:27 — <GestureDetector> has no prop `onClick`. ' +
          'Check the API reference for the available props.',
      ),
    );
  });
});
describe('lowerComponent — useAsync', () => {
  const storageContext = async (): Promise<CompileContext> => {
    const api = await loadPluginApi('flutter_secure_storage');
    const [hook] = deriveHooks(api, undefined);
    if (hook === undefined) {
      throw new Error('expected the derived useSecureStorage hook');
    }
    const storage = api.classes.find(
      (entity) => entity.name === 'FlutterSecureStorage',
    );
    return {
      ...(await contextOnce()),
      pluginHooks: new Map([
        [
          'useSecureStorage',
          {
            hook,
            methods: new Map(
              storage?.methods.map((method) => [method.name, method]) ?? [],
            ),
            fields: new Map(
              storage?.fields.map((field) => [field.name, field.type]) ?? [],
            ),
          },
        ],
      ]),
    };
  };

  const lowerProbe = async (): Promise<IrComponent> => {
    const analysis = analyzeSource(
      "import { CircularProgressIndicator, Text, useAsync } from 'flutter-tsx';\n" +
        "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
        'export const Probe = async () => {\n' +
        '  const storage = useSecureStorage();\n' +
        '  const hasToken = await useAsync(\n' +
        "    () => storage.containsKey({ key: 'token' }),\n" +
        '    {\n' +
        '      loading: () => <CircularProgressIndicator />,\n' +
        '      error: (err) => <Text>{err}</Text>,\n' +
        '    },\n' +
        '  );\n' +
        '  return <Text>{hasToken}</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    return lowerComponent(component, await storageContext());
  };

  test('the future is a late field assigned in initState', async () => {
    const ir = await lowerProbe();

    expect(ir.kind).toBe('stateful');
    expect(ir.fields).toEqual([
      {
        name: '_storage',
        dartType: 'FlutterSecureStorage',
        mutable: false,
        initializer: 'const FlutterSecureStorage()',
      },
      {
        name: '_hasTokenFuture',
        dartType: 'Future<bool>',
        mutable: false,
        initializer: null,
        lateFinal: true,
      },
    ]);
    expect(ir.initStatements).toEqual([
      {
        kind: 'dart',
        line: "_hasTokenFuture = _storage.containsKey(key: 'token');",
      },
    ]);
  });

  const lowerCustom = async (asyncBody: string): Promise<IrComponent> => {
    const analysis = analyzeSource(
      "import { CircularProgressIndicator, Text, useAsync } from 'flutter-tsx';\n" +
        "import { useSecureStorage } from 'plugin:flutter_secure_storage';\n" +
        'export const Probe = async () => {\n' +
        '  const storage = useSecureStorage();\n' +
        asyncBody +
        '  return <Text>done</Text>;\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    return lowerComponent(component, await storageContext());
  };

  test('a future the compiler cannot type is a numbered error', () => {
    expect(
      lowerCustom(
        '  const value = await useAsync(() => fetchSomething(), {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0321 probe.tsx:5:38 — `useAsync` needs a Future whose type the ' +
          'compiler knows: read it off a plugin, e.g. ' +
          '`useAsync(() => storage.readAll(), …)`.',
      ),
    );
  });

  test('a void plugin method cannot back a future', () => {
    expect(
      lowerCustom(
        '  const value = await useAsync(\n' +
          "    () => storage.write({ key: 'k', value: 'v' }),\n" +
          '    {\n' +
          '      loading: () => <CircularProgressIndicator />,\n' +
          '      error: (err) => <Text>{err}</Text>,\n' +
          '    },\n' +
          '  );\n',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0321 probe.tsx:6:11 — `useAsync` needs a Future whose type the ' +
          'compiler knows: read it off a plugin, e.g. ' +
          '`useAsync(() => storage.readAll(), …)`.',
      ),
    );
  });

  test('a stream source that is no plugin read is a numbered error', () => {
    expect(
      lowerCustom(
        '  const value = await useStream(() => someStream, {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0321 probe.tsx:5:39 — `useStream` needs a Stream whose type the ' +
          'compiler knows: read it off a plugin, e.g. ' +
          '`useStream(() => storage.readAll(), …)`.',
      ),
    );
  });

  test('an unknown property on a plugin cannot back a stream', () => {
    expect(
      lowerCustom(
        '  const value = await useStream(() => storage.nope, {\n' +
          '    loading: () => <CircularProgressIndicator />,\n' +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0321 probe.tsx:5:39 — `useStream` needs a Stream whose type the ' +
          'compiler knows: read it off a plugin, e.g. ' +
          '`useStream(() => storage.readAll(), …)`.',
      ),
    );
  });

  test('a fallback that is not a widget is a numbered error', () => {
    expect(
      lowerCustom(
        '  const value = await useAsync(() => storage.readAll(), {\n' +
          "    loading: () => 'nope',\n" +
          '    error: (err) => <Text>{err}</Text>,\n' +
          '  });\n',
      ),
    ).rejects.toThrow(
      new Error(
        'TSX0204 probe.tsx:6:20 — a component must return a widget element.',
      ),
    );
  });

  test('the body becomes a typed FutureBuilder with all three states', async () => {
    const ir = await lowerProbe();

    expect(ir.body.name).toBe('FutureBuilder<bool>');
    expect(ir.body.args.map((argument) => argument.param)).toEqual([
      'future',
      'builder',
    ]);
    expect(ir.body.args[0]?.value).toEqual({
      kind: 'dartExpr',
      dart: '_hasTokenFuture',
    });

    const builder = ir.body.args[1]?.value;
    if (builder?.kind !== 'builder') {
      throw new Error('expected a builder value');
    }
    expect(builder.params).toEqual(['context', 'snapshot']);
    expect(builder.guards.map((guard) => guard.condition)).toEqual([
      'snapshot.hasError',
      '!snapshot.hasData',
    ]);
    expect(builder.guards[0]?.bind).toEqual({
      name: 'err',
      dart: "'${snapshot.error}'",
    });
    expect(builder.guards[1]?.bind).toBeNull();
    expect(builder.bind).toEqual({
      name: 'hasToken',
      dart: 'snapshot.data!',
    });
  });
});
describe('lowerComponent — store diagnostics', () => {
  const storeSource = (handlerBody: string): string =>
    "import { Text, createStore, useStore } from 'flutter-tsx';\n" +
    "const counterStore = createStore({ count: 0, label: 'Taps' });\n" +
    'export const Probe = () => {\n' +
    '  const [state, setState] = useStore(counterStore);\n' +
    '  const bump = () => {\n' +
    handlerBody +
    '  };\n' +
    '  return <Text>{state.count}</Text>;\n' +
    '};\n';

  const lowerStoreProbe = async (
    handlerBody: string,
    stores?: Map<string, IrStore>,
  ): Promise<IrComponent> => {
    const analysis = analyzeSource(storeSource(handlerBody), 'probe.tsx');
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const base = await contextOnce();
    return lowerComponent(component, {
      ...base,
      stores:
        stores ??
        new Map(
          analysis.stores.map((store) => [store.name, lowerStore(store)]),
        ),
    });
  };

  test('a setter without an object patch is a numbered error', () => {
    expect(lowerStoreProbe('    setState(1);\n')).rejects.toThrow(
      new Error(
        'TSX0325 probe.tsx:6:5 — a store setter takes an object of the ' +
          'fields to change: `setState({ count: 1 })`.',
      ),
    );
  });

  test('patching an unknown field is a numbered error', () => {
    expect(lowerStoreProbe('    setState({ ghost: 1 });\n')).rejects.toThrow(
      new Error('TSX0326 probe.tsx:6:16 — the store has no field `ghost`.'),
    );
  });

  test('a store missing from the context is a numbered error', () => {
    expect(
      lowerStoreProbe('    setState({ count: 1 });\n', new Map()),
    ).rejects.toThrow(
      new Error(
        'TSX0322 probe.tsx:3:14 — `counterStore` is not a store created in ' +
          'this file with `createStore({ … })`.',
      ),
    );
  });
});
describe('lowerComponent — navigation diagnostics', () => {
  test('an unknown navigation method is a numbered error', async () => {
    const analysis = analyzeSource(
      "import { ElevatedButton, Text, useNavigation } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const nav = useNavigation();\n' +
        '  return (\n' +
        "    <ElevatedButton onClick={() => nav.teleport('/x')}>\n" +
        '      Go\n' +
        '    </ElevatedButton>\n' +
        '  );\n' +
        '};\n',
      'probe.tsx',
    );
    const [component] = analysis.components;
    if (component === undefined) {
      throw new Error('expected a component');
    }
    const context = await contextOnce();

    expect(() => lowerComponent(component, context)).toThrow(
      new Error(
        'TSX0329 probe.tsx:5:40 — navigation has no `teleport`: use push, ' +
          'replace, go or pop.',
      ),
    );
  });
});
