import type {
  ConstantModel,
  ConstructorModel,
  ParamModel,
  TypeNode,
} from '../api/model';
import {
  asArray,
  asObject,
  asString,
  parseConstant,
  parseConstructor,
  parseParam,
  parseTypeNode,
} from '../api/parse';

export interface PluginMethod {
  name: string;
  doc: string;
  returnType: TypeNode;
  params: ParamModel[];
}

export interface PluginClass {
  name: string;
  doc: string;
  constructors: ConstructorModel[];
  methods: PluginMethod[];
  constants: ConstantModel[];
}

export interface PluginEnum {
  name: string;
  values: string[];
}

export interface PluginApi {
  package: string;
  version: string;
  classes: PluginClass[];
  enums: PluginEnum[];
  functions: PluginMethod[];
}

const parseCallable = (value: unknown, path: string): PluginMethod => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    returnType: parseTypeNode(record.returnType, `${path}.returnType`),
    params: asArray(record.params, `${path}.params`).map((param, index) =>
      parseParam(param, `${path}.params[${index}]`),
    ),
  };
};

const parseClass = (value: unknown, path: string): PluginClass => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    doc: asString(record.doc, `${path}.doc`),
    constructors: asArray(record.constructors, `${path}.constructors`).map(
      (constructor, index) =>
        parseConstructor(constructor, `${path}.constructors[${index}]`),
    ),
    methods: asArray(record.methods, `${path}.methods`).map((method, index) =>
      parseCallable(method, `${path}.methods[${index}]`),
    ),
    constants: asArray(record.constants, `${path}.constants`).map(
      (constant, index) =>
        parseConstant(constant, `${path}.constants[${index}]`),
    ),
  };
};

const parseEnum = (value: unknown, path: string): PluginEnum => {
  const record = asObject(value, path);
  return {
    name: asString(record.name, `${path}.name`),
    values: asArray(record.values, `${path}.values`).map((entry, index) =>
      asString(
        asObject(entry, `${path}.values[${index}]`).name,
        `${path}.values[${index}].name`,
      ),
    ),
  };
};

export const parsePluginApi = (value: unknown, label: string): PluginApi => {
  const record = asObject(value, `${label}: root`);
  return {
    package: asString(record.package, `${label}: package`),
    version: asString(record.version, `${label}: version`),
    classes: asArray(record.classes, `${label}: classes`).map((entity, index) =>
      parseClass(entity, `${label}: classes[${index}]`),
    ),
    enums: asArray(record.enums, `${label}: enums`).map((entity, index) =>
      parseEnum(entity, `${label}: enums[${index}]`),
    ),
    functions: asArray(record.functions, `${label}: functions`).map(
      (entity, index) => parseCallable(entity, `${label}: functions[${index}]`),
    ),
  };
};

export const loadPluginApi = async (
  packageName: string,
): Promise<PluginApi> => {
  const location = new URL(
    `../../ref/plugins/${packageName}.json`,
    import.meta.url,
  ).pathname;
  const file = Bun.file(location);
  if (!(await file.exists())) {
    throw new Error(
      `plugins/${packageName}.json does not exist — run ` +
        `\`bun run extract:plugin ${packageName}\` first.`,
    );
  }
  const document: unknown = await file.json();
  return parsePluginApi(document, `plugins/${packageName}.json`);
};
