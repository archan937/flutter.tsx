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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: false,
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
      complete: true,
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
      complete: false,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: true,
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
      complete: false,
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
      complete: true,
    });
  });
});
