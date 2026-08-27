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
      bind: IrBuilderBind | null;
      value: IrValue;
    };

export interface IrBuilderBind {
  name: string;
  dart: string;
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

export interface IrField {
  name: string;
  dartType: string;
  mutable: boolean;
  initializer: string | null;
  // `late final` — assigned once in initState (a useAsync future).
  lateFinal?: boolean;
}

export type IrStatement =
  { kind: 'setState'; assignments: string[] } | { kind: 'dart'; line: string };

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
  pluginImports: string[];
  body: IrWidget;
}
