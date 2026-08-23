import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot, ConstructorModel, ParamModel } from '@src/api/model';
import type { SlotMap } from '@src/derive/slots';
import { buildSitePage, dartSignature } from '@src/site/from-snapshot';

const param = (
  name: string,
  display: string,
  overrides: Partial<ParamModel> = {},
): ParamModel => ({
  name,
  type: { kind: 'scalar', name: 'String' },
  display,
  named: true,
  required: false,
  defaultValue: null,
  doc: '',
  deprecated: false,
  ...overrides,
});

describe('dartSignature', () => {
  test('renders an empty constructor inline', () => {
    const constructor: ConstructorModel = { name: '', doc: '', params: [] };
    expect(dartSignature('Spacer', constructor)).toBe('Spacer()');
  });

  test('renders named parameters with defaults and required markers', () => {
    const constructor: ConstructorModel = {
      name: '',
      doc: '',
      params: [
        param('key', 'Key?'),
        param('mainAxisAlignment', 'MainAxisAlignment', {
          defaultValue: 'MainAxisAlignment.start',
        }),
        param('children', 'List<Widget>', {
          defaultValue: 'const <Widget>[]',
        }),
        param('color', 'Color', { required: true }),
      ],
    };

    expect(dartSignature('Column', constructor)).toBe(
      [
        'Column({',
        '  Key? key,',
        '  MainAxisAlignment mainAxisAlignment = MainAxisAlignment.start,',
        '  List<Widget> children = const <Widget>[],',
        '  required Color color,',
        '})',
      ].join('\n'),
    );
  });

  test('renders positional parameters before the named group', () => {
    const constructor: ConstructorModel = {
      name: '',
      doc: '',
      params: [
        param('data', 'String', { named: false, required: true }),
        param('key', 'Key?'),
      ],
    };

    expect(dartSignature('Text', constructor)).toBe(
      ['Text(', '  String data, {', '  Key? key,', '})'].join('\n'),
    );
  });

  test('renders positional-only constructors without a named group', () => {
    const constructor: ConstructorModel = {
      name: '',
      doc: '',
      params: [param('child', 'Widget', { named: false, required: true })],
    };

    expect(dartSignature('Wrapper', constructor)).toBe(
      ['Wrapper(', '  Widget child,', ')'].join('\n'),
    );
  });
});

describe('buildSitePage', () => {
  const snapshot: ApiSnapshot = {
    meta: {
      frameworkVersion: '3.47.1',
      dartSdkVersion: '3.13.1',
      frameworkRevision: 'abc123',
    },
    hierarchy: {},
    entities: [
      {
        kind: 'enum',
        name: 'TestAlign',
        library: 'painting',
        doc: '/// How to align.',
        values: [
          { name: 'start', doc: '' },
          { name: 'end', doc: '' },
        ],
      },
      {
        kind: 'class',
        name: 'TestPalette',
        library: 'material',
        doc: '',
        supertypes: [],
        constructors: [],
        constants: [
          {
            name: 'main',
            type: { kind: 'named', name: 'PaintLike' },
            display: 'PaintLike',
            doc: '',
          },
        ],
      },
      {
        kind: 'widget',
        name: 'Frame',
        library: 'widgets',
        doc: '/// A frame.\n///\n/// More detail.',
        supertypes: ['StatelessWidget', 'Widget'],
        constructors: [
          {
            name: '',
            doc: '',
            params: [
              param('key', 'Key?'),
              param('child', 'Widget?'),
              param('paint', 'PaintLike', {
                required: true,
                type: { kind: 'named', name: 'PaintLike' },
              }),
              param('onPressed', 'VoidCallback?', {
                type: {
                  kind: 'nullable',
                  inner: {
                    kind: 'function',
                    returnType: { kind: 'void' },
                    params: [],
                  },
                },
              }),
            ],
          },
        ],
        constants: [],
      },
    ],
  };

  const slots: SlotMap = {
    Frame: { children: { param: 'child', kind: 'widget' }, slots: [] },
  };

  test('builds the complete page model', () => {
    expect(buildSitePage(snapshot, slots)).toEqual({
      flutterVersion: '3.47.1',
      widgets: [
        {
          name: 'Frame',
          library: 'widgets',
          doc: '/// A frame.\n///\n/// More detail.',
          props: [
            {
              tsxProp: 'children',
              tsType: 'FlutterChild',
              dartType: 'Widget?',
              required: false,
            },
            {
              tsxProp: 'paint',
              tsType: 'PaintLike',
              dartType: 'PaintLike',
              required: true,
            },
            {
              tsxProp: 'onClick',
              tsType: '() => void',
              dartType: 'VoidCallback?',
              required: false,
            },
          ],
          tsxExample:
            '<Frame paint={TestPalette.main}>\n  <Text>Content</Text>\n</Frame>',
          exampleComplete: true,
          dartSignature: [
            'Frame({',
            '  Key? key,',
            '  Widget? child,',
            '  required PaintLike paint,',
            '  VoidCallback? onPressed,',
            '})',
          ].join('\n'),
        },
      ],
      enums: [
        {
          name: 'TestAlign',
          library: 'painting',
          doc: '/// How to align.',
          values: ['start', 'end'],
        },
      ],
      incompleteExamples: [],
    });
  });
});
