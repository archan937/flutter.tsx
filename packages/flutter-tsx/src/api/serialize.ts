import type {
  ApiSnapshot,
  ConstantModel,
  ConstructorModel,
  Entity,
  ParamModel,
  TypeNode,
} from './model';

const typeNodeToJson = (node: TypeNode): Record<string, unknown> => {
  switch (node.kind) {
    case 'widget':
    case 'void':
    case 'unknown':
      return { kind: node.kind };
    case 'scalar':
    case 'enum':
    case 'named':
      return { kind: node.kind, name: node.name };
    case 'nullable':
      return { kind: node.kind, inner: typeNodeToJson(node.inner) };
    case 'list':
    case 'set':
    case 'future':
      return { kind: node.kind, item: typeNodeToJson(node.item) };
    case 'map':
      return {
        kind: node.kind,
        key: typeNodeToJson(node.key),
        value: typeNodeToJson(node.value),
      };
    case 'function':
      return {
        kind: node.kind,
        returnType: typeNodeToJson(node.returnType),
        params: node.params.map((param) => ({
          name: param.name,
          type: typeNodeToJson(param.type),
          named: param.named,
          required: param.required,
        })),
      };
  }
};

const paramToJson = (param: ParamModel): Record<string, unknown> => ({
  name: param.name,
  type: typeNodeToJson(param.type),
  display: param.display,
  named: param.named,
  required: param.required,
  defaultValue: param.defaultValue,
  doc: param.doc,
  deprecated: param.deprecated,
});

const constructorToJson = (
  constructor: ConstructorModel,
): Record<string, unknown> => ({
  name: constructor.name,
  doc: constructor.doc,
  const: constructor.isConst,
  paramMemberAsserts: constructor.paramMemberAsserts,
  params: constructor.params.map(paramToJson),
});

const constantToJson = (constant: ConstantModel): Record<string, unknown> => ({
  name: constant.name,
  type: typeNodeToJson(constant.type),
  display: constant.display,
  doc: constant.doc,
});

const entityToJson = (entity: Entity): Record<string, unknown> => {
  if (entity.kind === 'enum') {
    return {
      kind: entity.kind,
      name: entity.name,
      library: entity.library,
      doc: entity.doc,
      values: entity.values.map((value) => ({
        name: value.name,
        doc: value.doc,
      })),
    };
  }
  return {
    kind: entity.kind,
    name: entity.name,
    library: entity.library,
    doc: entity.doc,
    supertypes: entity.supertypes,
    constructors: entity.constructors.map(constructorToJson),
    constants: entity.constants.map(constantToJson),
  };
};

const sortedNameListMap = (
  source: Record<string, string[]>,
): Record<string, string[]> => {
  const sorted: Record<string, string[]> = {};
  for (const name of Object.keys(source).sort()) {
    sorted[name] = source[name] ?? [];
  }
  return sorted;
};

export const serializeApiSnapshot = (snapshot: ApiSnapshot): string => {
  const document = {
    meta: {
      frameworkVersion: snapshot.meta.frameworkVersion,
      dartSdkVersion: snapshot.meta.dartSdkVersion,
      frameworkRevision: snapshot.meta.frameworkRevision,
    },
    hierarchy: sortedNameListMap(snapshot.hierarchy),
    exports: sortedNameListMap(snapshot.exports),
    entities: snapshot.entities.map(entityToJson),
  };
  return `${JSON.stringify(document, null, 2)}\n`;
};
