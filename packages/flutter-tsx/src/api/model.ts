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
  // `T` — what a generic class is built for, named so it can be bound.
  | { kind: 'typeVar'; name: string }
  | { kind: 'scalar'; name: ScalarName }
  | { kind: 'enum'; name: string }
  // `args` is what the type was written with: the `Color` of an
  // `Animation<Color>`, which is part of what a value of it has to be.
  | { kind: 'named'; name: string; args?: TypeNode[] }
  | { kind: 'nullable'; inner: TypeNode }
  | { kind: 'list'; item: TypeNode }
  | { kind: 'set'; item: TypeNode }
  | { kind: 'map'; key: TypeNode; value: TypeNode }
  | { kind: 'future'; item: TypeNode }
  | { kind: 'stream'; item: TypeNode }
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
  paramMemberAsserts: boolean;
  // Groups where a Dart assert demands at least one member be supplied —
  // a requirement no optional-param type can express.
  requiredOneOf: string[][];
  params: ParamModel[];
}

/** A readable member of a class: `BoxConstraints.maxWidth`. */
export interface FieldModel {
  name: string;
  type: TypeNode;
  doc: string;
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

/** A method a class offers without an instance: `MediaQuery.of(context)`. */
export interface StaticMethod {
  name: string;
  doc: string;
  returnType: TypeNode;
  params: ParamModel[];
}

export interface WidgetEntity extends EntityBase {
  kind: 'widget';
  supertypes: string[];
  constructors: ConstructorModel[];
  constants: ConstantModel[];
  fields: FieldModel[];
  /** How the framework hands over values nothing constructs. */
  statics: StaticMethod[];
  /** The same, without arguments: `SystemMouseCursors.basic`-style getters. */
  staticGetters: FieldModel[];
  /** What a value of this type answers to: `scroll.jumpTo(0)`. */
  methods: StaticMethod[];
}

export interface ClassEntity extends EntityBase {
  kind: 'class';
  supertypes: string[];
  constructors: ConstructorModel[];
  constants: ConstantModel[];
  fields: FieldModel[];
  statics: StaticMethod[];
  staticGetters: FieldModel[];
  methods: StaticMethod[];
  /** Whether a component owning one of these has to release it. */
  disposable: boolean;
  /** Whether nothing can build one: only a concrete subclass can be. */
  isAbstract: boolean;
  /** The names this class is generic over: the `T` of a `ValueNotifier<T>`. */
  typeParams: string[];
  /**
   * What it hands each generic supertype — `CustomClipper<Path>` for a
   * `ShapeBorderClipper` — which is what makes it usable as one.
   */
  supertypeBindings: Record<string, TypeNode[]>;
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
  exports: Hierarchy;
  entities: Entity[];
}
