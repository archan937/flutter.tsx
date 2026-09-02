import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot, ConstructorModel, ParamModel } from '@src/api/model';
import type { SlotMap } from '@src/derive/slots';
import {
  buildSitePage,
  dartSignature,
  type SiteSections,
} from '@src/site/from-snapshot';

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
    const constructor: ConstructorModel = {
      name: '',
      doc: '',
      isConst: true,
      paramMemberAsserts: false,
      requiredOneOf: [],
      params: [],
    };
    expect(dartSignature('Spacer', constructor)).toBe('Spacer()');
  });

  test('renders named parameters with defaults and required markers', () => {
    const constructor: ConstructorModel = {
      name: '',
      doc: '',
      isConst: true,
      paramMemberAsserts: false,
      requiredOneOf: [],
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
      isConst: true,
      paramMemberAsserts: false,
      requiredOneOf: [],
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
      isConst: true,
      paramMemberAsserts: false,
      requiredOneOf: [],
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
    exports: {},
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
        disposable: false,
        isAbstract: false,
        typeParams: [],
        supertypeBindings: {},
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
        fields: [],
        statics: [],
        staticGetters: [],
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
            isConst: true,
            paramMemberAsserts: false,
            requiredOneOf: [],
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
        fields: [],
        statics: [],
        staticGetters: [],
      },
    ],
  };

  const slots: SlotMap = {
    Frame: { children: { param: 'child', kind: 'widget' }, slots: [] },
  };

  const sections: SiteSections = {
    examples: [
      {
        id: '01-camera-screen',
        title: 'Camera Screen',
        label: 'Camera',
        blurb: '',
        tsx: "import { useCamera } from 'plugin:camera';\n",
        dart: "import 'package:camera/camera.dart';\n",
      },
    ],
    coreApi: [],
    plugins: [],
    // No generated declarations: the value types come from the file that
    // ships them, and this snapshot ships none.
    generatedFiles: [],
  };

  test('builds the complete page model', () => {
    expect(buildSitePage(snapshot, slots, sections)).toEqual({
      flutterVersion: '3.47.1',
      examples: sections.examples,
      coreApi: [],
      types: [],
      plugins: [],
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
              tsType: 'PaintLikeValue',
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
          example: {
            tsx: '<Frame paint="main">\n  <Text>Content</Text>\n</Frame>',
            bindings: [],
            unwritable: [],
            complete: true,
          },
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
