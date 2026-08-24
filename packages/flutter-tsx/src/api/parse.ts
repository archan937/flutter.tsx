import {
  type ApiSnapshot,
  type ConstantModel,
  type ConstructorModel,
  type Entity,
  type EnumValue,
  type FunctionParam,
  type Hierarchy,
  type ParamModel,
  SCALAR_NAMES,
  type ScalarName,
  type TypeNode,
} from './model';

const fail = (path: string, problem: string): never => {
  throw new Error(`api.json: ${path}: ${problem}`);
};

const asObject = (value: unknown, path: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return fail(path, 'expected an object');
  }
  return value as Record<string, unknown>;
};

const asArray = (value: unknown, path: string): unknown[] => {
  if (!Array.isArray(value)) {
    return fail(path, 'expected an array');
  }
  return value as unknown[];
};

const asString = (value: unknown, path: string): string =>
  typeof value === 'string' ? value : fail(path, 'expected a string');

const asBoolean = (value: unknown, path: string): boolean =>
  typeof value === 'boolean' ? value : fail(path, 'expected a boolean');

const asStringOrNull = (value: unknown, path: string): string | null => {
  if (value === null || typeof value === 'string') {
    return value;
  }
  return fail(path, 'expected a string or null');
};

const asScalarName = (value: unknown, path: string): ScalarName => {
  const name = asString(value, path);
  if (!(SCALAR_NAMES as readonly string[]).includes(name)) {
    return fail(path, `unknown scalar type "${name}"`);
  }
  return name as ScalarName;
};

const parseFunctionParam = (value: unknown, path: string): FunctionParam => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    type: parseTypeNode(record.type, `${path}.type`),
    named: asBoolean(record.named, `${path}.named`),
    required: asBoolean(record.required, `${path}.required`),
  };
};

export const parseTypeNode = (value: unknown, path: string): TypeNode => {
  const record = asObject(value, path);
  const kind = asString(record.kind, `${path}.kind`);

  switch (kind) {
    case 'widget':
    case 'void':
    case 'unknown':
      return { kind };
    case 'scalar':
      return { kind, name: asScalarName(record.name, `${path}.name`) };
    case 'enum':
    case 'named':
      return { kind, name: asString(record.name, `${path}.name`) };
    case 'nullable':
      return { kind, inner: parseTypeNode(record.inner, `${path}.inner`) };
    case 'list':
    case 'set':
    case 'future':
      return { kind, item: parseTypeNode(record.item, `${path}.item`) };
    case 'map':
      return {
        kind,
        key: parseTypeNode(record.key, `${path}.key`),
        value: parseTypeNode(record.value, `${path}.value`),
      };
    case 'function':
      return {
        kind,
        returnType: parseTypeNode(record.returnType, `${path}.returnType`),
        params: asArray(record.params, `${path}.params`).map((param, index) =>
          parseFunctionParam(param, `${path}.params[${index}]`),
        ),
      };
    default:
      return fail(`${path}.kind`, `unknown type kind "${kind}"`);
  }
};

const parseParam = (value: unknown, path: string): ParamModel => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    type: parseTypeNode(record.type, `${path}.type`),
    display: asString(record.display, `${path}.display`),
    named: asBoolean(record.named, `${path}.named`),
    required: asBoolean(record.required, `${path}.required`),
    defaultValue: asStringOrNull(record.defaultValue, `${path}.defaultValue`),
    doc: asString(record.doc, `${path}.doc`),
    deprecated: asBoolean(record.deprecated, `${path}.deprecated`),
  };
};

const parseConstructor = (value: unknown, path: string): ConstructorModel => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    isConst: asBoolean(record.const, `${path}.const`),
    paramMemberAsserts: asBoolean(
      record.paramMemberAsserts,
      `${path}.paramMemberAsserts`,
    ),
    params: asArray(record.params, `${path}.params`).map((param, index) =>
      parseParam(param, `${path}.params[${index}]`),
    ),
  };
};

const parseConstant = (value: unknown, path: string): ConstantModel => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    type: parseTypeNode(record.type, `${path}.type`),
    display: asString(record.display, `${path}.display`),
    doc: asString(record.doc, `${path}.doc`),
  };
};

const parseEnumValue = (value: unknown, path: string): EnumValue => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
  };
};

const parseEntity = (value: unknown, path: string): Entity => {
  const record = asObject(value, path);
  const kind = asString(record.kind, `${path}.kind`);
  const base = {
    name: asString(record.name, `${path}.name`),
    library: asString(record.library, `${path}.library`),
    doc: asString(record.doc, `${path}.doc`),
  };

  switch (kind) {
    case 'widget':
    case 'class':
      return {
        kind,
        ...base,
        supertypes: asArray(record.supertypes, `${path}.supertypes`).map(
          (supertype, index) =>
            asString(supertype, `${path}.supertypes[${index}]`),
        ),
        constructors: asArray(record.constructors, `${path}.constructors`).map(
          (constructor, index) =>
            parseConstructor(constructor, `${path}.constructors[${index}]`),
        ),
        constants: asArray(record.constants, `${path}.constants`).map(
          (constant, index) =>
            parseConstant(constant, `${path}.constants[${index}]`),
        ),
      };
    case 'enum':
      return {
        kind,
        ...base,
        values: asArray(record.values, `${path}.values`).map((value, index) =>
          parseEnumValue(value, `${path}.values[${index}]`),
        ),
      };
    default:
      return fail(`${path}.kind`, `unknown entity kind "${kind}"`);
  }
};

const parseNameListMap = (value: unknown, path: string): Hierarchy => {
  const record = asObject(value, path);
  const parsed: Hierarchy = {};
  for (const [name, names] of Object.entries(record)) {
    parsed[name] = asArray(names, `${path}.${name}`).map((entry, index) =>
      asString(entry, `${path}.${name}[${index}]`),
    );
  }
  return parsed;
};

export const parseApiSnapshot = (value: unknown): ApiSnapshot => {
  const record = asObject(value, 'root');
  const meta = asObject(record.meta, 'meta');
  return {
    meta: {
      frameworkVersion: asString(
        meta.frameworkVersion,
        'meta.frameworkVersion',
      ),
      dartSdkVersion: asString(meta.dartSdkVersion, 'meta.dartSdkVersion'),
      frameworkRevision: asString(
        meta.frameworkRevision,
        'meta.frameworkRevision',
      ),
    },
    hierarchy: parseNameListMap(record.hierarchy, 'hierarchy'),
    exports: parseNameListMap(record.exports, 'exports'),
    entities: asArray(record.entities, 'entities').map((entity, index) =>
      parseEntity(entity, `entities[${index}]`),
    ),
  };
};
