import { describe, expect, test } from 'bun:test';

import type { ParamModel, TypeNode } from '@src/api/model';
import type { WidgetSlots } from '@src/derive/slots';
import { type SynthesisContext, synthesizeTsx } from '@src/site/synthesize';

const param = (
  name: string,
  type: TypeNode,
  overrides: Partial<ParamModel> = {},
): ParamModel => ({
  name,
  type,
  display: 'x',
  named: true,
  required: true,
  defaultValue: null,
  doc: '',
  deprecated: false,
  ...overrides,
});

const context: SynthesisContext = {
  enumValues: { TestAlign: 'start' },
  ownedValues: new Set(['TestController']),
  widgetExamples: new Map([['Badge', '<Badge label="example" />']]),
  valueOnlyNames: new Set(['Icons']),
  formNames: new Set(['IconData', 'Ornament']),
  declaredTypes: new Set(['IconData', 'Ornament', 'Intent']),
  construction: new Map([
    [
      'Ink',
      [
        {
          name: 'InkSplash',
          typeParams: [],
          params: [
            param('kind', { kind: 'scalar', name: 'String' }, { named: false }),
            param('shade', { kind: 'scalar', name: 'String' }),
          ],
        },
      ],
    ],
  ]),
  forms: {
    constantMembers: new Map([['IconData', new Map([['add', 'Icons']])]]),
    constructibles: new Map([
      [
        'Ornament',
        [
          param('tint', {
            kind: 'nullable',
            inner: { kind: 'named', name: 'Color' },
          }),
        ],
      ],
    ]),
  },
};

const noSlots: WidgetSlots = { children: null, slots: [] };

describe('synthesizeTsx', () => {
  test('a value that must be bound comes with the line that binds it', () => {
    // An Animation is not a literal: it is held by the component that drives
    // it, so the example is the component, and the reference shows what a
    // developer would really write.
    expect(
      synthesizeTsx({
        widgetName: 'FadeTransition',
        params: [param('opacity', { kind: 'named', name: 'Animation' })],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<FadeTransition opacity={animation} />',
      bindings: [
        {
          line: 'const animation = useAnimation({ duration: 600 });',
          imports: ['useAnimation'],
        },
      ],
      complete: true,
      unwritable: [],
    });
  });

  test('a value the component owns is made in the example that uses it', () => {
    expect(
      synthesizeTsx({
        widgetName: 'Field',
        params: [
          param('controller', { kind: 'named', name: 'TestController' }),
        ],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Field controller={testController} />',
      bindings: [
        {
          line: 'const testController = new TestController();',
          imports: ['TestController'],
        },
      ],
      complete: true,
      unwritable: [],
    });
  });

  test('an abstract type is written as the class that makes one', () => {
    // `Ink` cannot be built; `InkSplash` is one, so that is what an example
    // of a prop asking for an Ink shows.
    expect(
      synthesizeTsx({
        widgetName: 'Splash',
        params: [param('ink', { kind: 'named', name: 'Ink' })],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      // Dart's positional arguments stay positional; its named ones are the
      // trailing object, which is what the typings declare.
      tsx: '<Splash ink={new InkSplash("example", { shade: "example" })} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('a generic value is built for what the prop asked for', () => {
    const generic: SynthesisContext = {
      ...context,
      construction: new Map([
        [
          'Holder',
          [
            {
              name: 'Holder',
              typeParams: ['T'],
              params: [
                param(
                  'value',
                  { kind: 'typeVar', name: 'T' },
                  { named: false },
                ),
              ],
            },
          ],
        ],
      ]),
    };

    expect(
      synthesizeTsx({
        widgetName: 'Counter',
        params: [
          param('holder', {
            kind: 'named',
            name: 'Holder',
            args: [{ kind: 'scalar', name: 'int' }],
          }),
        ],
        slots: noSlots,
        context: generic,
      }),
    ).toEqual({
      tsx: '<Counter holder={new Holder(8)} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('a value of no particular type is written as one', () => {
    // A widget generic over what it is given — a Radio's value — takes
    // whatever the example gives it.
    expect(
      synthesizeTsx({
        widgetName: 'Radio',
        params: [param('value', { kind: 'unknown' })],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Radio value="example" />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('a widget asked for by name is written as its own example', () => {
    expect(
      synthesizeTsx({
        widgetName: 'Shell',
        params: [param('badge', { kind: 'named', name: 'Badge' })],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Shell badge={<Badge label="example" />} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('a value that cannot be written leaves the example incomplete', () => {
    // An animation over a type nothing can express has no tween to show,
    // and a class asking for one cannot be built either. Both say so rather
    // than showing something that would not compile.
    const params = [
      param('alignment', {
        kind: 'named',
        name: 'Animation',
        args: [{ kind: 'named', name: 'Unwritable' }],
      }),
    ];

    expect(
      synthesizeTsx({ widgetName: 'Drift', params, slots: noSlots, context }),
    ).toEqual({
      tsx: '<Drift alignment={…} />',
      bindings: [],
      complete: false,
      unwritable: [
        { prop: 'alignment', type: 'x', reason: 'supplied-by-flutter' },
      ],
    });

    expect(
      synthesizeTsx({
        widgetName: 'Splash',
        params: [param('ink', { kind: 'named', name: 'Ink' })],
        slots: noSlots,
        context: {
          ...context,
          construction: new Map([
            [
              'Ink',
              [
                {
                  name: 'InkSplash',
                  typeParams: [],
                  params: [
                    param('shade', { kind: 'named', name: 'Unwritable' }),
                  ],
                },
              ],
            ],
          ]),
        },
      }),
    ).toEqual({
      tsx: '<Splash ink={…} />',
      bindings: [],
      complete: false,
      // `Ink` is a class the SDK builds; what it asks for is what is not
      // yet written, so the work is ours rather than Flutter's.
      unwritable: [{ prop: 'ink', type: 'x', reason: 'not-yet-expressible' }],
    });
  });

  test('a leaf widget without required props self-closes', () => {
    expect(
      synthesizeTsx({
        widgetName: 'Spacer',
        params: [],
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Spacer />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('fills required props with canonical values', () => {
    const params = [
      param('label', { kind: 'scalar', name: 'String' }),
      param('count', { kind: 'scalar', name: 'int' }),
      param('scale', { kind: 'scalar', name: 'double' }),
      param('enabled', { kind: 'scalar', name: 'bool' }),
      param('align', { kind: 'enum', name: 'TestAlign' }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Probe',
        params,
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Probe label="example" count={8} scale={1} enabled={true} align="start" />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('resolves required class values through their value forms', () => {
    const params = [
      param('icon', { kind: 'named', name: 'IconData' }),
      param('padding', { kind: 'named', name: 'EdgeInsetsGeometry' }),
      param('ornament', { kind: 'named', name: 'Ornament' }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Icon',
        params,
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Icon icon="add" padding={8} ornament={{}} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('required callbacks become empty arrow functions', () => {
    const params = [
      param('onClick', {
        kind: 'nullable',
        inner: { kind: 'function', returnType: { kind: 'void' }, params: [] },
      }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Pressable',
        params,
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Pressable onClick={() => {}} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('skips optional props entirely', () => {
    const params = [
      param('label', { kind: 'scalar', name: 'String' }, { required: false }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Quiet',
        params,
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Quiet />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('map values with non-record keys are incomplete', () => {
    const params = [
      param('shortcuts', {
        kind: 'map',
        key: { kind: 'named', name: 'ShortcutActivator' },
        value: { kind: 'named', name: 'Intent' },
      }),
    ];

    expect(
      synthesizeTsx({ widgetName: 'Keys', params, slots: noSlots, context }),
    ).toEqual({
      tsx: '<Keys shortcuts={…} />',
      bindings: [],
      complete: false,
      unwritable: [
        { prop: 'shortcuts', type: 'x', reason: 'not-yet-expressible' },
      ],
    });
  });

  test('record-keyed map values become empty objects', () => {
    const params = [
      param('labels', {
        kind: 'map',
        key: { kind: 'scalar', name: 'String' },
        value: { kind: 'scalar', name: 'int' },
      }),
    ];

    expect(
      synthesizeTsx({ widgetName: 'Tags', params, slots: noSlots, context }),
    ).toEqual({
      tsx: '<Tags labels={{}} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('marks unresolvable required values as incomplete placeholders', () => {
    const params = [param('painter', { kind: 'named', name: 'CustomPainter' })];

    expect(
      synthesizeTsx({
        widgetName: 'Canvas',
        params,
        slots: noSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Canvas painter={…} />',
      bindings: [],
      complete: false,
      // Nothing here builds a CustomPainter, so it is a value Flutter
      // supplies rather than one still to be written.
      unwritable: [
        { prop: 'painter', type: 'x', reason: 'supplied-by-flutter' },
      ],
    });
  });

  test('wraps children per slot kind', () => {
    const listSlots: WidgetSlots = {
      children: { param: 'children', kind: 'widgetList' },
      slots: [],
    };
    expect(
      synthesizeTsx({
        widgetName: 'Column',
        params: [],
        slots: listSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Column>\n  <Text>Item 1</Text>\n  <Text>Item 2</Text>\n</Column>',
      bindings: [],
      complete: true,
      unwritable: [],
    });

    const singleSlots: WidgetSlots = {
      children: { param: 'child', kind: 'widget' },
      slots: [],
    };
    expect(
      synthesizeTsx({
        widgetName: 'Center',
        params: [],
        slots: singleSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Center>\n  <Text>Content</Text>\n</Center>',
      bindings: [],
      complete: true,
      unwritable: [],
    });

    const textSlots: WidgetSlots = {
      children: { param: 'data', kind: 'text' },
      slots: [],
    };
    expect(
      synthesizeTsx({
        widgetName: 'Text',
        params: [],
        slots: textSlots,
        context,
      }),
    ).toEqual({
      tsx: '<Text>Hello world</Text>',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('the children param and optional slots never render as attributes', () => {
    const slots: WidgetSlots = {
      children: { param: 'child', kind: 'widget' },
      slots: [
        { param: 'appBar', accepts: 'PreferredSizeWidget', mode: 'single' },
      ],
    };
    const params = [
      param('child', { kind: 'widget' }),
      param(
        'appBar',
        { kind: 'named', name: 'PreferredSizeWidget' },
        {
          required: false,
        },
      ),
      param('title', { kind: 'scalar', name: 'String' }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Frame',
        params,
        slots,
        context,
      }),
    ).toEqual({
      tsx: '<Frame title="example">\n  <Text>Content</Text>\n</Frame>',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('required slot params receive element values', () => {
    const slots: WidgetSlots = {
      children: null,
      slots: [
        { param: 'header', accepts: 'Widget', mode: 'single' },
        { param: 'rows', accepts: 'Widget', mode: 'multi' },
      ],
    };
    const params = [
      param('header', { kind: 'widget' }),
      param('rows', { kind: 'list', item: { kind: 'widget' } }),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Sheet',
        params,
        slots,
        context,
      }),
    ).toEqual({
      tsx: '<Sheet header={<Text>Content</Text>} rows={[]} />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });
});
// Flutter states some requirements only in a constructor assert; the example
// must satisfy them or it compiles to Dart that throws at const-eval.
describe('synthesizeTsx — assert-implied requirements', () => {
  test('supplies the first expressible member of a one-of group', () => {
    const params = [
      param(
        'message',
        {
          kind: 'nullable',
          inner: { kind: 'scalar', name: 'String' },
        },
        { required: false },
      ),
      param(
        'richMessage',
        {
          kind: 'nullable',
          inner: { kind: 'named', name: 'InlineSpan' },
        },
        { required: false },
      ),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Tooltip',
        params,
        slots: { children: { kind: 'widget', param: 'child' }, slots: [] },
        context,
        requiredOneOf: [['message', 'richMessage']],
      }),
    ).toEqual({
      tsx: '<Tooltip message="example">\n  <Text>Content</Text>\n</Tooltip>',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });

  test('a group of only inexpressible members marks the example incomplete', () => {
    const params = [
      param(
        'filter',
        {
          kind: 'nullable',
          inner: { kind: 'named', name: 'ImageFilter' },
        },
        { required: false },
      ),
      param(
        'filterConfig',
        {
          kind: 'nullable',
          inner: { kind: 'named', name: 'ImageFilterConfig' },
        },
        { required: false },
      ),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'BackdropFilter',
        params,
        slots: { children: { kind: 'widget', param: 'child' }, slots: [] },
        context,
        requiredOneOf: [['filter', 'filterConfig']],
      }),
    ).toEqual({
      tsx:
        '<BackdropFilter filter={…}>\n  <Text>Content</Text>\n' +
        '</BackdropFilter>',
      bindings: [],
      complete: false,
      unwritable: [
        { prop: 'filter', type: 'x', reason: 'supplied-by-flutter' },
      ],
    });
  });

  test('a member already supplied as a required prop satisfies the group', () => {
    const params = [
      param('title', { kind: 'scalar', name: 'String' }),
      param(
        'message',
        {
          kind: 'nullable',
          inner: { kind: 'scalar', name: 'String' },
        },
        { required: false },
      ),
    ];

    expect(
      synthesizeTsx({
        widgetName: 'Sheet',
        params,
        slots: noSlots,
        context,
        requiredOneOf: [['title', 'message']],
      }),
    ).toEqual({
      tsx: '<Sheet title="example" />',
      bindings: [],
      complete: true,
      unwritable: [],
    });
  });
});
