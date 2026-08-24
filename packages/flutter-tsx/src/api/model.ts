export interface SdkMeta {
  frameworkVersion: string;
  dartSdkVersion: string;
  frameworkRevision: string;
}

export const SCALAR_NAMES = ['String', 'bool', 'int', 'double', 'num'] as const;

export type ScalarName = (typeof SCALAR_NAMES)[number];

export type TypeNode =
  | { kind: 'widget' }
  | { kind: 'void' }
  | { kind: 'unknown' }
  | { kind: 'scalar'; name: ScalarName }
  | { kind: 'enum'; name: string }
  | { kind: 'named'; name: string }
  | { kind: 'nullable'; inner: TypeNode }
  | { kind: 'list'; item: TypeNode }
  | { kind: 'set'; item: TypeNode }
  | { kind: 'map'; key: TypeNode; value: TypeNode }
  | { kind: 'future'; item: TypeNode }
  | { kind: 'function'; returnType: TypeNode; params: FunctionParam[] };

export interface FunctionParam {
  name: string;
  type: TypeNode;
  named: boolean;
  required: boolean;
}

export interface ParamModel {
  name: string;
  type: TypeNode;
  display: string;
  named: boolean;
  required: boolean;
  defaultValue: string | null;
  doc: string;
  deprecated: boolean;
}

export interface ConstructorModel {
  name: string;
  doc: string;
  isConst: boolean;
  params: ParamModel[];
}

export interface ConstantModel {
  name: string;
  type: TypeNode;
  display: string;
  doc: string;
}

interface EntityBase {
  name: string;
  library: string;
  doc: string;
}

export interface WidgetEntity extends EntityBase {
  kind: 'widget';
  supertypes: string[];
  constructors: ConstructorModel[];
  constants: ConstantModel[];
}

export interface ClassEntity extends EntityBase {
  kind: 'class';
  supertypes: string[];
  constructors: ConstructorModel[];
  constants: ConstantModel[];
}

export interface EnumValue {
  name: string;
  doc: string;
}

export interface EnumEntity extends EntityBase {
  kind: 'enum';
  values: EnumValue[];
}

export type Entity = WidgetEntity | ClassEntity | EnumEntity;

export type Hierarchy = Record<string, string[]>;

export interface ApiSnapshot {
  meta: SdkMeta;
  hierarchy: Hierarchy;
  entities: Entity[];
}
