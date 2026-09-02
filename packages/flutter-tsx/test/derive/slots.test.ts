import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import type {
  ApiSnapshot,
  Entity,
  Hierarchy,
  ParamModel,
  TypeNode,
  WidgetEntity,
} from '@src/api/model';
import { deriveSlots } from '@src/derive/slots';

const param = (
  name: string,
  type: TypeNode,
  overrides: Partial<ParamModel> = {},
): ParamModel => ({
  name,
  type,
  display: 'x',
  named: true,
  required: false,
  defaultValue: null,
  doc: '',
  deprecated: false,
  ...overrides,
});

const widget = (name: string, params: ParamModel[]): WidgetEntity => ({
  kind: 'widget',
  name,
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
      params,
    },
  ],
  constants: [],
  fields: [],
  statics: [],
  staticGetters: [],
});

const snapshotWith = (
  entities: Entity[],
  hierarchy: Hierarchy = {},
): ApiSnapshot => ({
  meta: {
    frameworkVersion: '3.47.1',
    dartSdkVersion: '3.13.1',
    frameworkRevision: 'abc123',
  },
  hierarchy,
  exports: {},
  entities,
});

const NULLABLE_WIDGET: TypeNode = {
  kind: 'nullable',
  inner: { kind: 'widget' },
};
const WIDGET_LIST: TypeNode = { kind: 'list', item: { kind: 'widget' } };

describe('deriveSlots (synthetic snapshots)', () => {
  test('multi-child widgets get a children list slot', () => {
    const slots = deriveSlots(
      snapshotWith([widget('FlexLike', [param('children', WIDGET_LIST)])]),
    );

    expect(slots).toEqual({
      FlexLike: {
        children: { param: 'children', kind: 'widgetList' },
        slots: [],
      },
    });
  });

  test('single-child widgets get a child slot', () => {
    const slots = deriveSlots(
      snapshotWith([widget('CenterLike', [param('child', NULLABLE_WIDGET)])]),
    );

    expect(slots).toEqual({
      CenterLike: {
        children: { param: 'child', kind: 'widget' },
        slots: [],
      },
    });
  });

  // Scaffold and NestedScrollView name their content `body`. It is the one
  // child a developer writes between the tags, so it is the child slot.
  test('a widget whose content parameter is named body gets a child slot', () => {
    const slots = deriveSlots(
      snapshotWith([
        widget('ScaffoldLike', [
          param('body', NULLABLE_WIDGET),
          param('appBar', NULLABLE_WIDGET),
        ]),
      ]),
    );

    expect(slots).toEqual({
      ScaffoldLike: {
        children: { param: 'body', kind: 'widget' },
        slots: [{ param: 'appBar', accepts: 'Widget', mode: 'single' }],
      },
    });
  });

  test('a child parameter still wins over a body parameter', () => {
    const slots = deriveSlots(
      snapshotWith([
        widget('BothLike', [
          param('body', NULLABLE_WIDGET),
          param('child', NULLABLE_WIDGET),
        ]),
      ]),
    );

    expect(slots.BothLike?.children).toEqual({
      param: 'child',
      kind: 'widget',
    });
  });

  test('a positional string content parameter becomes a text slot', () => {
    const slots = deriveSlots(
      snapshotWith([
        widget('TextLike', [
          param(
            'data',
            { kind: 'scalar', name: 'String' },
            {
              named: false,
              required: true,
            },
          ),
          param('maxLines', {
            kind: 'nullable',
            inner: { kind: 'scalar', name: 'int' },
          }),
        ]),
      ]),
    );

    expect(slots).toEqual({
      TextLike: {
        children: { param: 'data', kind: 'text' },
        slots: [],
      },
    });
  });

  test('named widget-typed parameters become named slots, matched via the hierarchy', () => {
    const slots = deriveSlots(
      snapshotWith(
        [
          widget('ScaffoldLike', [
            param('appBar', {
              kind: 'nullable',
              inner: { kind: 'named', name: 'PreferredSizeWidget' },
            }),
            param('body', NULLABLE_WIDGET),
            param('persistentFooterButtons', {
              kind: 'nullable',
              inner: WIDGET_LIST,
            }),
            param('backgroundColor', {
              kind: 'nullable',
              inner: { kind: 'named', name: 'Color' },
            }),
          ]),
        ],
        { PreferredSizeWidget: ['Widget'], Color: [] },
      ),
    );

    expect(slots).toEqual({
      ScaffoldLike: {
        children: { param: 'body', kind: 'widget' },
        slots: [
          { param: 'appBar', accepts: 'PreferredSizeWidget', mode: 'single' },
          {
            param: 'persistentFooterButtons',
            accepts: 'Widget',
            mode: 'multi',
          },
        ],
      },
    });
  });

  test('a widget without a default constructor derives to a leaf', () => {
    const noDefault: WidgetEntity = {
      ...widget('FactoryOnly', []),
      constructors: [
        {
          name: 'custom',
          doc: '',
          isConst: true,
          paramMemberAsserts: false,
          requiredOneOf: [],
          params: [],
        },
      ],
    };

    expect(deriveSlots(snapshotWith([noDefault]))).toEqual({
      FactoryOnly: { children: null, slots: [] },
    });
  });

  test('non-widget entities contribute nothing', () => {
    const slots = deriveSlots(
      snapshotWith([
        {
          kind: 'enum',
          name: 'Axis',
          library: 'painting',
          doc: '',
          values: [],
        },
      ]),
    );

    expect(slots).toEqual({});
  });
});

describe('deriveSlots (real SDK snapshot, end to end)', () => {
  const realSlots = async (): Promise<Record<string, unknown>> =>
    deriveSlots(await loadApiSnapshot());

  test('Column collects children', async () => {
    expect((await realSlots()).Column).toEqual({
      children: { param: 'children', kind: 'widgetList' },
      slots: [],
    });
  });

  test('Center takes a single child', async () => {
    expect((await realSlots()).Center).toEqual({
      children: { param: 'child', kind: 'widget' },
      slots: [],
    });
  });

  test('Text takes text content', async () => {
    expect((await realSlots()).Text).toEqual({
      children: { param: 'data', kind: 'text' },
      slots: [],
    });
  });

  test('ElevatedButton takes a single child', async () => {
    expect((await realSlots()).ElevatedButton).toEqual({
      children: { param: 'child', kind: 'widget' },
      slots: [],
    });
  });

  test('Scaffold exposes its complete named-slot surface', async () => {
    expect((await realSlots()).Scaffold).toEqual({
      children: { param: 'body', kind: 'widget' },
      slots: [
        { param: 'appBar', accepts: 'PreferredSizeWidget', mode: 'single' },
        { param: 'bottomNavigationBar', accepts: 'Widget', mode: 'single' },
        { param: 'bottomSheet', accepts: 'Widget', mode: 'single' },
        { param: 'drawer', accepts: 'Widget', mode: 'single' },
        { param: 'endDrawer', accepts: 'Widget', mode: 'single' },
        { param: 'floatingActionButton', accepts: 'Widget', mode: 'single' },
        {
          param: 'persistentFooterButtons',
          accepts: 'Widget',
          mode: 'multi',
        },
      ],
    });
  });

  test('AppBar exposes its complete named-slot surface', async () => {
    expect((await realSlots()).AppBar).toEqual({
      children: null,
      slots: [
        { param: 'actions', accepts: 'Widget', mode: 'multi' },
        { param: 'bottom', accepts: 'PreferredSizeWidget', mode: 'single' },
        { param: 'flexibleSpace', accepts: 'Widget', mode: 'single' },
        { param: 'leading', accepts: 'Widget', mode: 'single' },
        { param: 'title', accepts: 'Widget', mode: 'single' },
      ],
    });
  });

  test('every extracted widget is covered', async () => {
    expect(Object.keys(await realSlots())).toHaveLength(542);
  });

  test('the committed ref/derived/slots.json is exactly the derived output', async () => {
    const snapshot = await loadApiSnapshot();
    const expected = `${JSON.stringify(
      {
        meta: { frameworkVersion: snapshot.meta.frameworkVersion },
        widgets: deriveSlots(snapshot),
      },
      null,
      2,
    )}\n`;

    const committed = await Bun.file(
      new URL('../../ref/derived/slots.json', import.meta.url),
    ).text();
    expect(committed).toBe(expected);
  });
});
