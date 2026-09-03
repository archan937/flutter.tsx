import type {
  ApiSnapshot,
  ConstantModel,
  ConstructorModel,
  Entity,
  ParamModel,
  StaticMethod,
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
    case 'typeVar':
      return { kind: node.kind, name: node.name };
    case 'named':
      return {
        kind: node.kind,
        name: node.name,
        ...(node.args === undefined || node.args.length === 0
          ? {}
          : { args: node.args.map(typeNodeToJson) }),
      };
    case 'nullable':
      return { kind: node.kind, inner: typeNodeToJson(node.inner) };
    case 'list':
    case 'set':
    case 'future':
    case 'stream':
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
  requiredOneOf: constructor.requiredOneOf,
  params: constructor.params.map(paramToJson),
});

const constantToJson = (constant: ConstantModel): Record<string, unknown> => ({
  name: constant.name,
  type: typeNodeToJson(constant.type),
  display: constant.display,
  doc: constant.doc,
});

const fieldToJson = (field: {
  name: string;
  doc: string;
  type: TypeNode;
}): Record<string, unknown> => ({
  name: field.name,
  doc: field.doc,
  type: typeNodeToJson(field.type),
});

const methodToJson = (
  method: StaticMethod,
  isStatic: boolean,
): Record<string, unknown> => ({
  name: method.name,
  doc: method.doc,
  static: isStatic,
  returnType: typeNodeToJson(method.returnType),
  params: method.params.map(paramToJson),
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
    fields: entity.fields.map(fieldToJson),
    ...(entity.statics.length > 0
      ? { statics: entity.statics.map((method) => methodToJson(method, true)) }
      : {}),
    ...(entity.staticGetters.length > 0
      ? { staticGetters: entity.staticGetters.map(fieldToJson) }
      : {}),
    ...(entity.methods.length > 0
      ? { methods: entity.methods.map((method) => methodToJson(method, false)) }
      : {}),
    ...(entity.kind === 'class'
      ? {
          disposable: entity.disposable,
          ...(entity.isAbstract ? { abstract: true } : {}),
          ...(entity.abstractMethods.length > 0
            ? {
                abstractMethods: entity.abstractMethods.map((method) =>
                  methodToJson(method, false),
                ),
              }
            : {}),
          ...(entity.abstractGetters.length > 0
            ? { abstractGetters: entity.abstractGetters.map(fieldToJson) }
            : {}),
          ...(entity.mixin === null ? {} : { mixin: entity.mixin }),
          ...(entity.typeParams.length > 0
            ? { typeParams: entity.typeParams }
            : {}),
          ...(entity.typeParamBounds.length > 0
            ? { typeParamBounds: entity.typeParamBounds }
            : {}),
          ...(Object.keys(entity.supertypeBindings).length > 0
            ? {
                supertypeBindings: Object.fromEntries(
                  Object.entries(entity.supertypeBindings).map(
                    ([name, args]) => [name, args.map(typeNodeToJson)],
                  ),
                ),
              }
            : {}),
        }
      : {}),
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
