import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot, WidgetEntity } from '@src/api/model';
import type { SlotMap } from '@src/derive/slots';
import {
  emitConstantsFile,
  emitGeneratedIndex,
  emitWidgetsFile,
} from '@src/generate/emit';

const snapshot: ApiSnapshot = {
  meta: {
    frameworkVersion: '3.47.1',
    dartSdkVersion: '3.13.1',
    frameworkRevision: 'abc123',
  },
  hierarchy: {
    BadgeLike: ['Widget'],
    Color: [],
    EdgeInsetsGeometry: [],
    MaterialColor: ['Color'],
    Frame: ['StatelessWidget', 'Widget'],
    Greeting: ['StatelessWidget', 'Widget'],
    Style: [],
  },
  exports: {},
  entities: [
    {
      kind: 'widget',
      name: 'Frame',
      library: 'widgets',
      doc: '/// A frame around a child.',
      supertypes: ['StatelessWidget', 'Widget'],
      constructors: [
        {
          name: '',
          doc: '/// Creates a frame.',
          isConst: true,
          paramMemberAsserts: false,
          requiredOneOf: [],
          params: [
            {
              name: 'key',
              type: { kind: 'nullable', inner: { kind: 'named', name: 'Key' } },
              display: 'Key?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
            {
              name: 'child',
              type: { kind: 'nullable', inner: { kind: 'widget' } },
              display: 'Widget?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The framed child.',
              deprecated: false,
            },
            {
              name: 'color',
              type: {
                kind: 'nullable',
                inner: { kind: 'named', name: 'Color' },
              },
              display: 'Color?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The fill color.',
              deprecated: false,
            },
            {
              name: 'alignment',
              type: { kind: 'enum', name: 'TestAlign' },
              display: 'TestAlign',
              named: true,
              required: true,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
            {
              name: 'onPressed',
              type: {
                kind: 'nullable',
                inner: {
                  kind: 'function',
                  returnType: { kind: 'void' },
                  params: [],
                },
              },
              display: 'VoidCallback?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// Called when the frame is pressed.',
              deprecated: false,
            },
            {
              name: 'badge',
              type: {
                kind: 'nullable',
                inner: { kind: 'named', name: 'BadgeLike' },
              },
              display: 'BadgeLike?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The badge shown on the frame.',
              deprecated: false,
            },
            {
              name: 'legacy',
              type: {
                kind: 'nullable',
                inner: { kind: 'scalar', name: 'String' },
              },
              display: 'String?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The old label.',
              deprecated: true,
            },
            {
              name: 'padding',
              type: {
                kind: 'nullable',
                inner: { kind: 'named', name: 'EdgeInsetsGeometry' },
              },
              display: 'EdgeInsetsGeometry?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The inner padding.',
              deprecated: false,
            },
            {
              name: 'style',
              type: {
                kind: 'nullable',
                inner: { kind: 'named', name: 'Style' },
              },
              display: 'Style?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ],
      constants: [],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      kind: 'widget',
      name: 'Greeting',
      library: 'widgets',
      doc: '/// Shows a greeting.',
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
              name: 'data',
              type: { kind: 'scalar', name: 'String' },
              display: 'String',
              named: false,
              required: true,
              defaultValue: null,
              doc: '/// The greeting text.',
              deprecated: false,
            },
            {
              name: 'maxLines',
              type: {
                kind: 'nullable',
                inner: { kind: 'scalar', name: 'int' },
              },
              display: 'int?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ],
      constants: [
        {
          name: 'defaultMaxLines',
          type: { kind: 'scalar', name: 'int' },
          display: 'int',
          doc: '/// The default line limit.',
        },
      ],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      kind: 'class',
      disposable: false,
      isAbstract: false,
      typeParams: [],
      supertypeBindings: {},
      name: 'Style',
      library: 'painting',
      doc: '/// How to paint a frame.',
      supertypes: [],
      constructors: [
        {
          name: '',
          doc: '/// Creates a style.',
          isConst: true,
          paramMemberAsserts: false,
          requiredOneOf: [],
          params: [
            {
              name: 'tint',
              type: {
                kind: 'nullable',
                inner: { kind: 'named', name: 'Color' },
              },
              display: 'Color?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '/// The tint color.',
              deprecated: false,
            },
            {
              name: 'size',
              type: {
                kind: 'nullable',
                inner: { kind: 'scalar', name: 'double' },
              },
              display: 'double?',
              named: true,
              required: false,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ],
      constants: [],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      kind: 'class',
      disposable: false,
      isAbstract: false,
      typeParams: [],
      supertypeBindings: {},
      name: 'TestPalette',
      library: 'material',
      doc: '/// Well-known colors.',
      supertypes: [],
      constructors: [],
      constants: [
        {
          name: 'main',
          type: { kind: 'named', name: 'MaterialColor' },
          display: 'MaterialColor',
          doc: '/// The main color.',
        },
      ],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    },
    {
      kind: 'enum',
      name: 'TestAlign',
      library: 'painting',
      doc: '/// How to align.',
      values: [
        { name: 'start', doc: '/// At the start.' },
        { name: 'end', doc: '/// At the end.' },
      ],
    },
  ],
};

const slots: SlotMap = {
  Frame: {
    children: { param: 'child', kind: 'widget' },
    slots: [{ param: 'badge', accepts: 'BadgeLike', mode: 'single' }],
  },
  Greeting: { children: { param: 'data', kind: 'text' }, slots: [] },
};

describe('emitWidgetsFile', () => {
  test('emits the complete widgets module', () => {
    const expected = `// GENERATED by \`bun run generate\` from ref/api.json — do not edit.
// Flutter 3.47.1

import { declareWidget } from '../runtime/component';
import { declareConstants } from '../runtime/constants';
import type {
  FlutterChild,
  FlutterChildren,
  FlutterComponent,
  FlutterElement,
  TextChildren,
} from '../runtime/types';

/**
 * How to align.
 */
export type TestAlign = 'start' | 'end';

export interface BadgeLike {
  readonly __fsxBrand?: { readonly BadgeLike: true; readonly Widget: true };
}

export interface Color {
  readonly __fsxBrand?: { readonly Color: true };
}

export interface EdgeInsetsGeometry {
  readonly __fsxBrand?: { readonly EdgeInsetsGeometry: true };
}

export interface Key {
  readonly __fsxBrand?: { readonly Key: true };
}

export interface MaterialColor {
  readonly __fsxBrand?: { readonly Color: true; readonly MaterialColor: true };
}

export interface Style {
  readonly __fsxBrand?: { readonly Style: true };
}

export declare const Style: new (options?: { tint?: ColorValue; size?: number }) => Style;

export interface TestPalette {
  readonly __fsxBrand?: { readonly TestPalette: true };
}

export type ColorValue =
  | Color
  | \`#\${string}\`
  | 'main';

export type EdgeInsetsGeometryValue =
  | EdgeInsetsGeometry
  | number
  | { horizontal?: number; vertical?: number }
  | { left?: number; top?: number; right?: number; bottom?: number };

export interface StyleObject {
  /**
   * The tint color.
   */
  tint?: ColorValue;
  size?: number;
}

export type StyleValue =
  | Style
  | StyleObject;

/**
 * A frame around a child.
 */
export interface FrameProps {
  /**
   * The framed child.
   */
  children?: FlutterChild;
  /**
   * The fill color.
   */
  color?: ColorValue;
  alignment: TestAlign;
  /**
   * Called when the frame is pressed.
   */
  onClick?: () => void;
  /**
   * The badge shown on the frame.
   */
  badge?: FlutterChild;
  /**
   * The old label.
   *
   * @deprecated
   */
  legacy?: string;
  /**
   * The inner padding.
   */
  padding?: EdgeInsetsGeometryValue;
  style?: StyleValue;
}

/**
 * A frame around a child.
 */
export const Frame: FlutterComponent<FrameProps> =
  declareWidget<FrameProps>('Frame');

/**
 * Shows a greeting.
 */
export interface GreetingProps {
  /**
   * The greeting text.
   */
  children: TextChildren;
  maxLines?: number;
}

/**
 * Shows a greeting.
 */
export const Greeting = Object.assign(
  declareWidget<GreetingProps>('Greeting'),
  declareConstants<{
    /**
     * The default line limit.
     */
    readonly defaultMaxLines: number;
  }>('Greeting'),
);
`;

    expect(emitWidgetsFile(snapshot, slots)).toBe(expected);
  });
});

describe('emitWidgetsFile guards', () => {
  test('fails loudly when a referenced enum was not extracted', () => {
    const broken: ApiSnapshot = {
      ...snapshot,
      entities: snapshot.entities.map((entity) =>
        entity.name === 'Frame' && entity.kind === 'widget'
          ? {
              ...entity,
              constructors: [
                {
                  name: '',
                  doc: '',
                  isConst: true,
                  paramMemberAsserts: false,
                  requiredOneOf: [],
                  params: [
                    {
                      name: 'behavior',
                      type: { kind: 'enum', name: 'MissingEnum' },
                      display: 'MissingEnum',
                      named: true,
                      required: true,
                      defaultValue: null,
                      doc: '',
                      deprecated: false,
                    },
                  ],
                },
              ],
            }
          : entity,
      ),
    };

    expect(() => emitWidgetsFile(broken, slots)).toThrow(
      new Error(
        'generated widgets: enum "MissingEnum" is referenced but not ' +
          'extracted — extend defaultFlutterLibraries in the extractor.',
      ),
    );
  });
});

describe('emitWidgetsFile value-form guards', () => {
  test('fails loudly when a generated alias collides with a real type', () => {
    const colliding: ApiSnapshot = {
      ...snapshot,
      hierarchy: { ...snapshot.hierarchy, ColorValue: [] },
      exports: {},
      entities: [
        ...snapshot.entities,
        {
          kind: 'class',
          disposable: false,
          isAbstract: false,
          typeParams: [],
          supertypeBindings: {},
          name: 'ColorValue',
          library: 'painting',
          doc: '',
          supertypes: [],
          constructors: [],
          constants: [
            {
              name: 'stub',
              type: { kind: 'named', name: 'ColorValue' },
              display: 'ColorValue',
              doc: '',
            },
          ],
          fields: [],
          statics: [],
          staticGetters: [],
          methods: [],
        },
        {
          kind: 'widget',
          name: 'Splash',
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
                  name: 'value',
                  type: {
                    kind: 'nullable',
                    inner: { kind: 'named', name: 'ColorValue' },
                  },
                  display: 'ColorValue?',
                  named: true,
                  required: false,
                  defaultValue: null,
                  doc: '',
                  deprecated: false,
                },
              ],
            },
          ],
          constants: [],
          fields: [],
          statics: [],
          staticGetters: [],
          methods: [],
        },
      ],
    };

    expect(() => emitWidgetsFile(colliding, slots)).toThrow(
      new Error(
        'generated widgets: "ColorValue" collides with an extracted ' +
          'type name — rename the value-form suffix.',
      ),
    );
  });
});

describe('emitGeneratedIndex', () => {
  test('star-exports widgets and re-exports constant namespaces explicitly', () => {
    const expected = `// GENERATED by \`bun run generate\` from ref/api.json — do not edit.
// Flutter 3.47.1

export * from './widgets';

export { TestPalette } from './constants';
`;
    expect(emitGeneratedIndex(snapshot)).toBe(expected);
  });
});

describe('emitConstantsFile', () => {
  test('emits constant namespaces importing their value types', () => {
    const expected = `// GENERATED by \`bun run generate\` from ref/api.json — do not edit.
// Flutter 3.47.1

import { declareConstants } from '../runtime/constants';
import type * as widgetTypes from './widgets';
import type { FlutterElement } from '../runtime/types';

/**
 * Well-known colors.
 */
export const TestPalette = declareConstants<{
  /**
   * The main color.
   */
  readonly main: widgetTypes.MaterialColor;
}>('TestPalette');
`;

    expect(emitConstantsFile(snapshot)).toBe(expected);
  });
});
// Any widget may carry gesture props (the compiler wraps in a
// GestureDetector), so the generated types must accept them — derived from
// GestureDetector's own constructor, never a hand-written list.
describe('emitWidgetsFile — gesture props', () => {
  const gestureDetector: WidgetEntity = {
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
          {
            name: 'onTap',
            type: {
              kind: 'nullable',
              inner: {
                kind: 'function',
                returnType: { kind: 'void' },
                params: [],
              },
            },
            display: 'VoidCallback?',
            named: true,
            required: false,
            defaultValue: null,
            doc: '/// Called on tap.',
            deprecated: false,
          },
          {
            name: 'onLongPress',
            type: {
              kind: 'nullable',
              inner: {
                kind: 'function',
                returnType: { kind: 'void' },
                params: [],
              },
            },
            display: 'VoidCallback?',
            named: true,
            required: false,
            defaultValue: null,
            doc: '',
            deprecated: false,
          },
          {
            name: 'behavior',
            type: { kind: 'nullable', inner: { kind: 'named', name: 'Key' } },
            display: 'Key?',
            named: true,
            required: false,
            defaultValue: null,
            doc: '',
            deprecated: false,
          },
        ],
      },
    ],
    constants: [],
    fields: [],
    statics: [],
    staticGetters: [],
    methods: [],
  };

  const withDetector: ApiSnapshot = {
    ...snapshot,
    entities: [...snapshot.entities, gestureDetector],
  };

  const emitWithDetector = (): string =>
    emitWidgetsFile(withDetector, {
      ...slots,
      GestureDetector: {
        children: { kind: 'widget', param: 'child' },
        slots: [],
      },
    });

  test('emits GestureProps from the detector callbacks only', () => {
    const emitted = emitWithDetector();
    const block = emitted.slice(
      emitted.indexOf('/**\n * Gestures any widget'),
      emitted.indexOf('/**\n * A frame around a child.'),
    );

    expect(block).toBe(
      '/**\n' +
        ' * Gestures any widget accepts: the compiler wraps it in a' +
        ' GestureDetector.\n' +
        ' */\n' +
        'export interface GestureProps {\n' +
        '  /**\n' +
        '   * Called on tap.\n' +
        '   */\n' +
        '  onClick?: () => void;\n' +
        '  onLongPress?: () => void;\n' +
        '}\n\n',
    );
  });

  const detectorParams =
    gestureDetector.constructors.find((constructor) => constructor.name === '')
      ?.params ?? [];

  test('a widget declaring every gesture prop inherits nothing', () => {
    const collidingWidget: WidgetEntity = {
      kind: 'widget',
      name: 'Pad',
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
          params: detectorParams.filter(
            (param) => param.name !== 'child' && param.name !== 'behavior',
          ),
        },
      ],
      constants: [],
      fields: [],
      statics: [],
      staticGetters: [],
      methods: [],
    };
    const emitted = emitWidgetsFile(
      {
        ...withDetector,
        entities: [...withDetector.entities, collidingWidget],
      },
      {
        ...slots,
        GestureDetector: {
          children: { kind: 'widget', param: 'child' },
          slots: [],
        },
      },
    );

    expect(emitted).toContain('export interface PadProps {\n');
  });

  test('every widget extends GestureProps, minus its own collisions', () => {
    const emitted = emitWithDetector();
    const headers = emitted
      .split('\n')
      .filter(
        (line) => line.startsWith('export interface') && line.endsWith('{'),
      );

    expect(headers).toEqual([
      'export interface BadgeLike {',
      'export interface Color {',
      'export interface EdgeInsetsGeometry {',
      'export interface Key {',
      'export interface MaterialColor {',
      'export interface Style {',
      // A class the constants module exports is a value there and a type
      // here, so this module declares it too.
      'export interface TestPalette {',
      'export interface StyleObject {',
      'export interface GestureProps {',
      "export interface FrameProps extends Omit<GestureProps, 'onClick'> {",
      'export interface GreetingProps extends GestureProps {',
      'export interface GestureDetectorProps {',
    ]);
  });
});
// The IDE has to guide icon choices: a bare `string` offers no completion and
// catches a typo only at compile time, so the SDK's own Icons names become a
// union type.
describe('emitConstantsFile — IconName', () => {
  const withIcons: ApiSnapshot = {
    ...snapshot,
    entities: [
      ...snapshot.entities,
      {
        kind: 'class',
        disposable: false,
        isAbstract: false,
        typeParams: [],
        supertypeBindings: {},
        name: 'Icons',
        library: 'material',
        doc: '',
        supertypes: [],
        constructors: [],
        constants: [
          {
            name: 'home',
            type: { kind: 'named', name: 'IconData' },
            display: 'IconData',
            doc: '',
          },
          {
            name: 'person',
            type: { kind: 'named', name: 'IconData' },
            display: 'IconData',
            doc: '',
          },
          {
            name: 'ac_unit',
            type: { kind: 'named', name: 'IconData' },
            display: 'IconData',
            doc: '',
          },
        ],
        fields: [],
        statics: [],
        staticGetters: [],
        methods: [],
      },
    ],
  };

  test('emits every Icons name as a union, sorted', () => {
    const emitted = emitConstantsFile(withIcons);

    expect(emitted).toContain(
      "export type IconName = 'ac_unit' | 'home' | 'person';",
    );
  });

  test('a snapshot without Icons emits no IconName', () => {
    expect(emitConstantsFile(snapshot)).not.toContain('IconName');
  });
});
