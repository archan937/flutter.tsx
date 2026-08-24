import type ts from 'typescript';

import type { HandlerBinding, PluginBinding, StateBinding } from './front-end';

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
  | { kind: 'closure'; params: string[] }
  | { kind: 'handlerRef'; name: string }
  | { kind: 'stateRef'; name: string }
  | { kind: 'raw'; node: ts.Expression }
  | { kind: 'widget'; widget: IrWidget }
  | { kind: 'widgetList'; items: IrChild[] };

export type IrChild =
  | { kind: 'value'; value: IrValue }
  | {
      kind: 'if';
      condition: IrValue;
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

export interface IrComponent {
  name: string;
  kind: 'stateless' | 'stateful';
  states: StateBinding[];
  plugins: PluginBinding[];
  handlers: HandlerBinding[];
  effects: ts.CallExpression[];
  body: IrWidget;
}
