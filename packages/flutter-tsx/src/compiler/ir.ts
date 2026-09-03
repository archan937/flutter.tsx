import type ts from 'typescript';

import type {
  HandlerBinding,
  PluginBinding,
  PropBinding,
  StateBinding,
} from './analyze';

export type IrValue =
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'enumValue'; enumName: string; member: string }
  | { kind: 'constantRef'; owner: string; member: string }
  | {
      kind: 'construct';
      className: string;
      constructorName: string;
      args: IrArgument[];
      /**
       * Whether the constructor is a const one. Most of the SDK's value
       * classes are; a `Tween` is not, and `const Tween(…)` does not compile.
       */
      constConstructor?: boolean;
      /** What the class is built for: the `Color` of a `Tween<Color>`. */
      typeArguments?: string[];
    }
  | {
      kind: 'closure';
      params: string[];
      /** `async` when the body awaits: Dart declares it the same way. */
      isAsync: boolean;
      statements: IrStatement[];
    }
  // A closure whose body is one expression, kept as a value so the printer
  // can wrap it: `(context) => showDialog(…)`.
  | {
      kind: 'closureValue';
      params: string[];
      /** `async` when the value is what its Future carries. */
      isAsync?: boolean;
      value: IrValue;
    }
  | {
      kind: 'conditional';
      condition: IrValue;
      whenTrue: IrValue;
      whenFalse: IrValue;
    }
  | {
      kind: 'interpolation';
      parts: { kind: 'text' | 'expr'; value: string }[];
    }
  // `_slide.drive(…)` — a method called on a value the component names.
  | {
      kind: 'invoke';
      receiver: string;
      method: string;
      args: IrArgument[];
    }
  | { kind: 'dartExpr'; dart: string }
  | { kind: 'handlerRef'; name: string }
  | { kind: 'stateRef'; name: string }
  | { kind: 'widget'; widget: IrWidget }
  | { kind: 'widgetList'; items: IrChild[] }
  /// `[a, b, c]` of ordinary values — a list of models, strings or numbers.
  | {
      kind: 'listValue';
      items: IrValue[];
      /**
       * How the collection is written: in braces for a set, and naming what
       * it holds when it is empty.
       */
      set?: { itemType: string | null; braces: boolean };
    }
  /// `{'a': 1}` — a Dart map, from an object literal or a `new Map([…])`.
  | {
      kind: 'mapValue';
      entries: { key: IrValue; value: IrValue }[];
      /** What an empty one holds, since `{}` alone says nothing. */
      types: { key: string | null; value: string | null };
    }
  | {
      kind: 'builder';
      params: string[];
      guards: IrBuilderGuard[];
      binds: IrBuilderBind[];
      value: IrValue;
    };

export interface IrBuilderBind {
  name: string;
  value: IrValue;
}

export interface IrBuilderGuard {
  condition: string;
  bind: IrBuilderBind | null;
  value: IrValue;
}

export type IrChild =
  | { kind: 'value'; value: IrValue }
  | {
      kind: 'if';
      condition: IrValue;
      child: { kind: 'value'; value: IrValue };
    }
  | {
      kind: 'for';
      itemName: string;
      iterable: IrValue;
      child: { kind: 'value'; value: IrValue };
    };

export interface IrArgument {
  param: string;
  positional: boolean;
  value: IrValue;
}

export interface IrWidget {
  name: string;
  constConstructor: boolean;
  args: IrArgument[];
}

/// A ChangeNotifier generated from a module-level `createStore({ … })`,
/// plus the single instance every component in the file shares.
export interface IrStore {
  className: string;
  instanceName: string;
  fields: { name: string; dartType: string; initializer: string }[];
}

/// One member of a written class: `void performLayout(Size size) { … }`.
export interface IrDelegateMember {
  name: string;
  returnDartType: string;
  /// Every parameter the override declares, whether the TSX named it or not:
  /// Dart's signature is the superclass's, not the author's.
  params: { name: string; dartType: string }[];
  /// A getter is written without parentheses, which is what Dart calls it.
  isGetter: boolean;
  isAsync: boolean;
  body:
    | { kind: 'expression'; value: IrValue }
    | { kind: 'block'; statements: IrStatement[] };
}

/// A class an app writes itself, from `defineDelegate('Name', { … })`, plus
/// the single instance every component in the file is handed.
export interface IrDelegate {
  className: string;
  instanceName: string;
  /// What it extends, type arguments and all: `RouterDelegate<Object>`.
  superclass: string;
  /// What it mixes in to be what it extends: `ChangeNotifier` for a
  /// `Listenable`.
  mixin: string | null;
  members: IrDelegateMember[];
}

/// A GoRouter built from `createRouter({ … })`.
export interface IrRouter {
  name: string;
  routes: { path: string; component: string }[];
}

/// A data class generated from a TS interface.
export interface IrModelField {
  name: string;
  dartType: string;
  required: boolean;
  /// True when the type is another generated model, which decodes recursively.
  isModel: boolean;
}

export interface IrEnum {
  name: string;
  dartType: string;
  members: { dartName: string; value: string }[];
}

export interface IrHelper {
  name: string;
  typeParams: string[];
  params: { name: string; dartType: string; defaultValue: string | null }[];
  returnDartType: string;
  /**
   * A one-expression helper is a Dart arrow function; one written with a body
   * keeps its body, so locals and early returns work as they read.
   */
  body:
    | { kind: 'expression'; value: IrValue }
    | { kind: 'block'; statements: IrStatement[] };
}

/** A top-level Dart constant generated from an exported module const. */
export interface IrConstant {
  name: string;
  dartType: string;
  value: IrValue;
}

export interface IrModel {
  name: string;
  fields: IrModelField[];
}

/// A Dart import contributed by a plugin: `import '<uri>' as <prefix>;` when
/// the package is used prefixed, plain otherwise.
export interface IrImport {
  uri: string;
  prefix: string | null;
}

export interface IrField {
  name: string;
  dartType: string;
  mutable: boolean;
  initializer: string | null;
  // `late final` — assigned once in initState (a useAsync future).
  lateFinal?: boolean;
}

export type IrStatement =
  | { kind: 'setState'; assignments: string[] }
  // Dart's try takes a catch, a finally, or both — exactly the shapes
  // TypeScript's does, so each clause is carried as written.
  | {
      kind: 'try';
      body: IrStatement[];
      onError: { error: string; body: IrStatement[] } | null;
      onFinally: IrStatement[] | null;
    }
  /// `final style = ElevatedButton.styleFrom(…);` — a name for a value.
  | { kind: 'local'; name: string; value: IrValue }
  | { kind: 'forOf'; itemName: string; iterable: string; body: IrStatement[] }
  | { kind: 'while'; condition: string; body: IrStatement[] }
  | {
      kind: 'switch';
      value: string;
      cases: { values: string[]; body: IrStatement[] }[];
      fallback: IrStatement[] | null;
    }
  // `if (c) { … } else { … }`; an `else if` chain is an `if` in `otherwise`.
  | {
      kind: 'if';
      condition: string;
      then: IrStatement[];
      otherwise: IrStatement[];
    }
  | { kind: 'dart'; line: string }
  // An expression the printer renders at its real column, so a call that has
  // to wrap does so correctly wherever the statement sits.
  | { kind: 'expr'; value: IrValue }
  // Work that must wait for the first frame — opening a route from a mount
  // effect, for instance, which throws if done during initState.
  | { kind: 'postFrame'; statements: IrStatement[] };

export interface IrMethod {
  name: string;
  isAsync: boolean;
  /** What the callback is handed: `onChanged={(value) => …}` takes one. */
  params: { name: string; dartType: string }[];
  statements: IrStatement[];
}

/** A callback a plugin's listener mixin declares, as this widget answers it. */
export interface IrOverride {
  name: string;
  params: { name: string; dartType: string }[];
  statements: IrStatement[];
}

export interface IrComponent {
  name: string;
  kind: 'stateless' | 'stateful';
  /** Mixins the State class carries, e.g. a plugin's listener. */
  mixins: string[];
  /** The listener callbacks this component answers. */
  overrides: IrOverride[];
  props: PropBinding[];
  states: StateBinding[];
  plugins: PluginBinding[];
  handlers: HandlerBinding[];
  effects: ts.CallExpression[];
  fields: IrField[];
  methods: IrMethod[];
  helpers: IrHelper[];
  setupMethods: { name: string; lines: string[] }[];
  initStatements: IrStatement[];
  disposeLines: string[];
  /** Statements from an effect's cleanup, run before the plugin lines. */
  disposeStatements: IrStatement[];
  pluginImports: IrImport[];
  /// `const x = …` from the component body, bound at the top of build().
  buildLocals: IrBuilderBind[];
  /// Early returns, in the order written, before the component's own tree.
  guards: { condition: string; value: IrValue }[];
  body: IrWidget;
}
