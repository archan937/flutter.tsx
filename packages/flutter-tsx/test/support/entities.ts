import type {
  ClassEntity,
  ConstructorModel,
  Entity,
  ParamModel,
  WidgetEntity,
} from '@src/api/model';

/**
 * The snapshot shapes a test builds on.
 *
 * A test cares about one or two fields of an entity; every other field is
 * noise that has to be written anyway, and writing it in each test is how a
 * new field in the model breaks twenty tests at once. These factories are
 * the one place that knows the full shape.
 */
export const param = (
  name: string,
  overrides: Partial<ParamModel> = {},
): ParamModel => ({
  name,
  type: { kind: 'scalar', name: 'String' },
  display: 'String',
  named: true,
  required: false,
  defaultValue: null,
  doc: '',
  deprecated: false,
  ...overrides,
});

export const constructor = (
  overrides: Partial<ConstructorModel> = {},
): ConstructorModel => ({
  name: '',
  doc: '',
  isConst: true,
  paramMemberAsserts: false,
  requiredOneOf: [],
  params: [],
  ...overrides,
});

const entityBase = (): Omit<WidgetEntity, 'kind' | 'name'> => ({
  library: 'widgets',
  doc: '',
  supertypes: [],
  constructors: [],
  constants: [],
  fields: [],
  statics: [],
  staticGetters: [],
  methods: [],
});

export const classEntity = (
  name: string,
  overrides: Partial<ClassEntity> = {},
): Entity =>
  Object.assign<ClassEntity, Partial<ClassEntity>>(
    {
      kind: 'class',
      ...entityBase(),
      name,
      disposable: false,
      isAbstract: false,
      abstractMethods: [],
      abstractGetters: [],
      mixin: null,
      typeParams: [],
      typeParamBounds: [],
      supertypeBindings: {},
    },
    overrides,
  );
