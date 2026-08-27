import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot } from '@src/api/model';
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
    },
    {
      kind: 'class',
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
    },
    {
      kind: 'class',
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
