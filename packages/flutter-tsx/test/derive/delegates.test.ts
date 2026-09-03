import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot, Entity } from '@src/api/model';
import { deriveDelegates } from '@src/derive/delegates';
import { classEntity, constructor, param } from '@test/support/entities';

const snapshotOf = (
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

const layoutDelegate = classEntity('LayoutDelegate', {
  library: 'rendering',
  doc: '/// Positions children.',
  isAbstract: true,
  abstractMethods: [
    {
      name: 'performLayout',
      doc: '/// Lays the children out.',
      returnType: { kind: 'void' },
      params: [param('size', { named: false, required: true })],
    },
  ],
  abstractGetters: [
    { name: 'extent', type: { kind: 'scalar', name: 'double' }, doc: '' },
  ],
});

describe('deriveDelegates', () => {
  test('a class an app writes carries its whole abstract surface', () => {
    const [delegate, ...rest] = deriveDelegates(snapshotOf([layoutDelegate]));

    expect(rest).toEqual([]);
    expect(delegate).toEqual({
      name: 'LayoutDelegate',
      library: 'rendering',
      doc: '/// Positions children.',
      mixin: null,
      typeParams: [],
      typeArguments: [],
      methods: [
        {
          name: 'performLayout',
          doc: '/// Lays the children out.',
          returnType: { kind: 'void' },
          params: [
            {
              name: 'size',
              type: { kind: 'scalar', name: 'String' },
              display: 'String',
              named: false,
              required: true,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ],
        },
      ],
      getters: [
        { name: 'extent', type: { kind: 'scalar', name: 'double' }, doc: '' },
      ],
    });
  });

  test('the bound of each parameter is what fills it', () => {
    // `class _Nav extends RouterDelegate<Object>` is the only valid Dart:
    // the superclass is generic, and a written subclass has to say what it
    // is generic over.
    const [delegate] = deriveDelegates(
      snapshotOf([
        classEntity('BoundedDelegate', {
          isAbstract: true,
          typeParams: ['TValue', 'TFree'],
          typeParamBounds: ['Listenable', 'Object'],
          mixin: 'ChangeNotifier',
          abstractMethods: [
            {
              name: 'read',
              doc: '',
              returnType: { kind: 'scalar', name: 'int' },
              params: [],
            },
          ],
        }),
      ]),
    );

    expect(delegate?.typeParams).toEqual(['TValue', 'TFree']);
    expect(delegate?.typeArguments).toEqual(['Listenable', 'Object']);
    expect(delegate?.mixin).toBe('ChangeNotifier');
  });

  test('what the SDK builds, hands over or answers with is not written', () => {
    // A `Shader` comes from a gradient, a `Path` builds itself, an
    // `ImageProvider` has concrete subclasses — none of them is an app's to
    // write, and offering to write one would be a lie.
    const entities: Entity[] = [
      classEntity('Buildable', {
        isAbstract: true,
        constructors: [constructor({ name: 'fromNothing' })],
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      }),
      classEntity('Subclassed', {
        isAbstract: true,
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      }),
      classEntity('Concrete', {
        supertypes: ['Subclassed'],
        constructors: [constructor()],
      }),
      classEntity('Answered', {
        isAbstract: true,
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      }),
      classEntity('Answerer', {
        methods: [
          {
            name: 'answer',
            doc: '',
            returnType: { kind: 'named', name: 'Answered' },
            params: [],
          },
        ],
      }),
      classEntity('Whole', {
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      }),
    ];

    expect(
      deriveDelegates(snapshotOf(entities, { Concrete: ['Subclassed'] })).map(
        (delegate) => delegate.name,
      ),
    ).toEqual([]);
  });

  test("the framework's own layers are not an app's to write", () => {
    // A widget is written as a component, and an element or a render object
    // is machinery underneath TSX rather than something written in it.
    const layered = (name: string, supertype: string): Entity =>
      classEntity(name, {
        isAbstract: true,
        supertypes: [supertype],
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      });

    expect(
      deriveDelegates(
        snapshotOf(
          [
            layered('WrittenAsAComponent', 'Widget'),
            layered('FrameworkMachinery', 'RenderObject'),
            layoutDelegate,
          ],
          {
            WrittenAsAComponent: ['Widget'],
            FrameworkMachinery: ['RenderObject'],
          },
        ),
      ).map((delegate) => delegate.name),
    ).toEqual(['LayoutDelegate']);
  });

  test('delegates come out in name order, whatever the snapshot holds', () => {
    const named = (name: string): Entity =>
      classEntity(name, {
        isAbstract: true,
        abstractMethods: [
          { name: 'read', doc: '', returnType: { kind: 'void' }, params: [] },
        ],
      });

    expect(
      deriveDelegates(snapshotOf([named('Zeta'), named('Alpha')])).map(
        (delegate) => delegate.name,
      ),
    ).toEqual(['Alpha', 'Zeta']);
  });
});
