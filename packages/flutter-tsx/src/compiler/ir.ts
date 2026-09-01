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
  | { kind: 'closureValue'; params: string[]; value: IrValue }
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
  | { kind: 'dartExpr'; dart: string }
  | { kind: 'handlerRef'; name: string }
  | { kind: 'stateRef'; name: string }
  | { kind: 'widget'; widget: IrWidget }
  | { kind: 'widgetList'; items: IrChild[] }
  /// `[a, b, c]` of ordinary values — a list of models, strings or numbers.
  | { kind: 'listValue'; items: IrValue[] }
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
  | { kind: 'try'; body: IrStatement[]; error: string; onError: IrStatement[] }
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
