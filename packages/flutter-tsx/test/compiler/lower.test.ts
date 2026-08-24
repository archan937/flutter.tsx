import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { analyzeSource } from '@src/compiler/analyze';
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
      { name: '_count', dartType: 'int', initializer: '0' },
      { name: '_label', dartType: 'String', initializer: "'x'" },
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
