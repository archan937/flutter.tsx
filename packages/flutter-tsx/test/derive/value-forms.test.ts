import { describe, expect, test } from 'bun:test';

import type {
  ApiSnapshot,
  ConstantModel,
  ConstructorModel,
  Entity,
  ParamModel,
} from '@src/api/model';
import {
  deriveValueForms,
  reachableValueFormNames,
} from '@src/derive/value-forms';

const namedConstant = (name: string, typeName: string): ConstantModel => ({
  name,
  type: { kind: 'named', name: typeName },
  display: typeName,
  doc: '',
});

const param = (
  name: string,
  typeName: string,
  overrides: Partial<ParamModel> = {},
): ParamModel => ({
  name,
  type: { kind: 'nullable', inner: { kind: 'named', name: typeName } },
  display: `${typeName}?`,
  named: true,
  required: false,
  defaultValue: null,
  doc: '',
  deprecated: false,
  ...overrides,
});

const defaultConstructor = (
  params: ParamModel[],
  isConst = true,
): ConstructorModel => ({
  name: '',
  doc: '',
  isConst,
  paramMemberAsserts: false,
  requiredOneOf: [],
  params,
});

const classEntity = (
  name: string,
  overrides: Partial<Extract<Entity, { kind: 'class' }>> = {},
): Entity => ({
  kind: 'class',
  name,
  library: 'painting',
  doc: '',
  supertypes: [],
  constructors: [],
  constants: [],
  fields: [],
  ...overrides,
});

const snapshotWith = (
  entities: Entity[],
  hierarchy: Record<string, string[]> = {},
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

describe('deriveValueForms — constant unions', () => {
  test('collects members per assignable type, keyed to their owner', () => {
    const forms = deriveValueForms(
      snapshotWith(
        [
          classEntity('Ink'),
          classEntity('Swatch'),
          classEntity('Palette', {
            constants: [
              namedConstant('crimson', 'Swatch'),
              namedConstant('azure', 'Swatch'),
            ],
            fields: [],
          }),
        ],
        { Swatch: ['Ink'] },
      ),
    );

    expect(forms.constantMembers).toEqual(
      new Map([
        [
          'Ink',
          new Map([
            ['azure', 'Palette'],
            ['crimson', 'Palette'],
          ]),
        ],
        [
          'Swatch',
          new Map([
            ['azure', 'Palette'],
            ['crimson', 'Palette'],
          ]),
        ],
      ]),
    );
  });

  test('the type itself wins a colliding member name', () => {
    const forms = deriveValueForms(
      snapshotWith([
        classEntity('Anchor', {
          constants: [namedConstant('center', 'Anchor')],
          fields: [],
        }),
        classEntity('Offsets', {
          constants: [
            namedConstant('center', 'Anchor'),
            namedConstant('edge', 'Anchor'),
          ],
          fields: [],
        }),
      ]),
    );

    expect(forms.constantMembers.get('Anchor')).toEqual(
      new Map([
        ['center', 'Anchor'],
        ['edge', 'Offsets'],
      ]),
    );
  });

  test('otherwise the owner with the most members wins, ties alphabetical', () => {
    const forms = deriveValueForms(
      snapshotWith([
        classEntity('Tone'),
        classEntity('Big', {
          constants: [
            namedConstant('loud', 'Tone'),
            namedConstant('soft', 'Tone'),
          ],
          fields: [],
        }),
        classEntity('Small', { constants: [namedConstant('loud', 'Tone')] }),
        classEntity('Aside', { constants: [namedConstant('quiet', 'Tone')] }),
        classEntity('Zeta', { constants: [namedConstant('quiet', 'Tone')] }),
      ]),
    );

    expect(forms.constantMembers.get('Tone')).toEqual(
      new Map([
        ['loud', 'Big'],
        ['quiet', 'Aside'],
        ['soft', 'Big'],
      ]),
    );
  });
});

describe('deriveValueForms — constructible value classes', () => {
  test('keeps classes with a const, fully named-optional default constructor', () => {
    const style = classEntity('Style', {
      constructors: [defaultConstructor([param('tint', 'Ink')])],
    });
    const controller = classEntity('Controller', {
      constructors: [defaultConstructor([param('tick', 'Ink')], false)],
    });
    const demanding = classEntity('Demanding', {
      constructors: [
        defaultConstructor([param('tint', 'Ink', { required: true })]),
      ],
    });
    const positional = classEntity('Positional', {
      constructors: [
        defaultConstructor([param('tint', 'Ink', { named: false })]),
      ],
    });
    const bare = classEntity('Bare', {
      constructors: [defaultConstructor([])],
    });

    const forms = deriveValueForms(
      snapshotWith([style, controller, demanding, positional, bare]),
    );

    expect(forms.constructibles).toEqual(
      new Map([['Style', [param('tint', 'Ink')]]]),
    );
  });

  test('reachability walks widget props and recurses through constructibles', () => {
    const snapshot = snapshotWith([
      {
        kind: 'widget',
        name: 'Frame',
        library: 'widgets',
        doc: '',
        supertypes: ['Widget'],
        constructors: [
          defaultConstructor([param('style', 'Style'), param('depth', 'Gap')]),
        ],
        constants: [],
        fields: [],
      },
      classEntity('Style', {
        constructors: [defaultConstructor([param('tint', 'Swatch')])],
      }),
      classEntity('Gap'),
      classEntity('Swatch'),
      classEntity('Palette', {
        constants: [namedConstant('crimson', 'Swatch')],
        fields: [],
      }),
      classEntity('Orphan', {
        constructors: [defaultConstructor([param('tint', 'Swatch')])],
      }),
    ]);
    const forms = deriveValueForms(snapshot);

    expect(reachableValueFormNames(snapshot, forms)).toEqual(
      new Set(['Style', 'Swatch']),
    );
  });

  test('the hex and edge-inset recipes count as reachable forms', () => {
    const snapshot = snapshotWith([
      {
        kind: 'widget',
        name: 'Frame',
        library: 'widgets',
        doc: '',
        supertypes: ['Widget'],
        constructors: [
          defaultConstructor([
            param('color', 'Color'),
            param('padding', 'EdgeInsetsGeometry'),
          ]),
        ],
        constants: [],
        fields: [],
      },
    ]);
    const forms = deriveValueForms(snapshot);

    expect(reachableValueFormNames(snapshot, forms)).toEqual(
      new Set(['Color', 'EdgeInsetsGeometry']),
    );
  });

  test('widgets never become object-literal constructibles', () => {
    const forms = deriveValueForms(
      snapshotWith([
        {
          kind: 'widget',
          name: 'Row',
          library: 'widgets',
          doc: '',
          supertypes: ['Widget'],
          constructors: [defaultConstructor([param('spacing', 'Ink')])],
          constants: [],
          fields: [],
        },
      ]),
    );

    expect(forms.constructibles).toEqual(new Map());
  });
});
