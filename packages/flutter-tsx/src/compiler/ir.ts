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
  | { kind: 'closure'; params: string[]; statements: IrStatement[] }
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
  | { kind: 'raw'; node: ts.Expression }
  | { kind: 'widget'; widget: IrWidget }
  | { kind: 'widgetList'; items: IrChild[] }
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

export interface IrHelper {
  name: string;
  params: { name: string; dartType: string }[];
  returnDartType: string;
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
  statements: IrStatement[];
}

export interface IrComponent {
  name: string;
  kind: 'stateless' | 'stateful';
  props: PropBinding[];
  states: StateBinding[];
  plugins: PluginBinding[];
  handlers: HandlerBinding[];
  effects: ts.CallExpression[];
  fields: IrField[];
  methods: IrMethod[];
  setupMethods: { name: string; lines: string[] }[];
  initStatements: IrStatement[];
  disposeLines: string[];
  pluginImports: IrImport[];
  /// `const x = …` from the component body, bound at the top of build().
  buildLocals: IrBuilderBind[];
  body: IrWidget;
}
