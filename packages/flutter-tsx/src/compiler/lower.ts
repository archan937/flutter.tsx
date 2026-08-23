import ts from 'typescript';

import type { ApiSnapshot, ParamModel } from '../api/model';
import type { SlotMap, WidgetSlots } from '../derive/slots';
import { jsxPropName } from '../generate/renames';
import { tsxErrorAt } from './diagnostics';
import type { ComponentAnalysis } from './front-end';
import type { IrArgument, IrChild, IrComponent, IrValue, IrWidget } from './ir';

interface WidgetInfo {
  name: string;
  paramsByJsxName: Map<string, ParamModel>;
  slots: WidgetSlots;
}

export interface CompileContext {
  widgets: Map<string, WidgetInfo>;
  enums: Map<string, Set<string>>;
}

const EMPTY_SLOTS: WidgetSlots = { children: null, slots: [] };

export const buildCompileContext = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
): CompileContext => {
  const widgets = new Map<string, WidgetInfo>();
  const enums = new Map<string, Set<string>>();

  for (const entity of snapshot.entities) {
    if (entity.kind === 'enum') {
      enums.set(entity.name, new Set(entity.values.map((value) => value.name)));
      continue;
    }
    if (entity.kind !== 'widget') {
      continue;
    }
    const constructor = entity.constructors.find(
      (candidate) => candidate.name === '',
    );
    if (constructor === undefined) {
      continue;
    }
    const takenNames = new Set(constructor.params.map((param) => param.name));
    const paramsByJsxName = new Map<string, ParamModel>();
    for (const param of constructor.params) {
      paramsByJsxName.set(jsxPropName(param.name, takenNames), param);
    }
    widgets.set(entity.name, {
      name: entity.name,
      paramsByJsxName,
      slots: slots[entity.name] ?? EMPTY_SLOTS,
    });
  }

  return { widgets, enums };
};

interface LowerContext {
  compile: CompileContext;
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  handlerNames: Set<string>;
}

const stripNullable = (param: ParamModel): ParamModel['type'] =>
  param.type.kind === 'nullable' ? param.type.inner : param.type;

const textWidget = (value: string): IrValue => ({
  kind: 'widget',
  widget: {
    name: 'Text',
    args: [
      { param: 'data', positional: true, value: { kind: 'string', value } },
    ],
  },
});

const lowerIdentifier = (
  identifier: ts.Identifier,
  context: LowerContext,
): IrValue => {
  if (context.handlerNames.has(identifier.text)) {
    return { kind: 'handlerRef', name: identifier.text };
  }
  if (context.stateNames.has(identifier.text)) {
    return { kind: 'stateRef', name: identifier.text };
  }
  return { kind: 'raw', node: identifier };
};

const lowerStringForParam = (
  text: string,
  target: { param: ParamModel; node: ts.Node },
  context: LowerContext,
): IrValue => {
  const paramType = stripNullable(target.param);
  if (paramType.kind !== 'enum') {
    return { kind: 'string', value: text };
  }
  const members = context.compile.enums.get(paramType.name);
  if (!members?.has(text)) {
    throw tsxErrorAt(
      'TSX0203',
      `\`${text}\` is not a ${paramType.name} member.`,
      { sourceFile: context.sourceFile, node: target.node },
    );
  }
  return { kind: 'enumValue', enumName: paramType.name, member: text };
};

const lowerExpression = (
  expression: ts.Expression,
  param: ParamModel,
  context: LowerContext,
): IrValue => {
  if (ts.isNumericLiteral(expression)) {
    return { kind: 'number', value: expression.getText() };
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return { kind: 'boolean', value: true };
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return { kind: 'boolean', value: false };
  }
  if (ts.isStringLiteral(expression)) {
    return lowerStringForParam(
      expression.text,
      { param, node: expression },
      context,
    );
  }
  if (ts.isIdentifier(expression)) {
    return lowerIdentifier(expression, context);
  }
  return { kind: 'raw', node: expression };
};

const lowerAttribute = (
  attribute: ts.JsxAttribute,
  info: WidgetInfo,
  context: LowerContext,
): IrArgument => {
  const jsxName = attribute.name.getText();
  const param = info.paramsByJsxName.get(jsxName);
  if (param === undefined) {
    throw tsxErrorAt(
      'TSX0202',
      `<${info.name}> has no prop \`${jsxName}\`. Check the API reference ` +
        'for the available props.',
      { sourceFile: context.sourceFile, node: attribute.name },
    );
  }

  const { initializer } = attribute;
  let value: IrValue;
  if (initializer === undefined) {
    value = { kind: 'boolean', value: true };
  } else if (ts.isStringLiteral(initializer)) {
    value = lowerStringForParam(
      initializer.text,
      { param, node: initializer },
      context,
    );
  } else if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined
  ) {
    value = lowerExpression(initializer.expression, param, context);
  } else {
    value = { kind: 'raw', node: initializer };
  }
  return { param: param.name, positional: !param.named, value };
};

const meaningfulText = (child: ts.JsxChild): string | null => {
  if (!ts.isJsxText(child)) {
    return null;
  }
  const text = child.text.trim();
  return text === '' ? null : text;
};

const lowerConditionChild = (
  expression: ts.BinaryExpression,
  context: LowerContext,
): IrChild => ({
  kind: 'if',
  condition: ts.isIdentifier(expression.left)
    ? lowerIdentifier(expression.left, context)
    : { kind: 'raw', node: expression.left },
  child: { kind: 'value', value: lowerChildValue(expression.right, context) },
});

const lowerChildValue = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue => {
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
    return { kind: 'widget', widget: lowerJsxElement(expression, context) };
  }
  if (ts.isIdentifier(expression)) {
    return lowerIdentifier(expression, context);
  }
  return { kind: 'raw', node: expression };
};

const lowerListChildren = (
  children: readonly ts.JsxChild[],
  context: LowerContext,
): IrChild[] => {
  const items: IrChild[] = [];
  for (const child of children) {
    const text = meaningfulText(child);
    if (text !== null) {
      items.push({ kind: 'value', value: textWidget(text) });
      continue;
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      items.push({
        kind: 'value',
        value: { kind: 'widget', widget: lowerJsxElement(child, context) },
      });
      continue;
    }
    if (ts.isJsxExpression(child) && child.expression !== undefined) {
      const { expression } = child;
      if (
        ts.isBinaryExpression(expression) &&
        expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
      ) {
        items.push(lowerConditionChild(expression, context));
        continue;
      }
      items.push({
        kind: 'value',
        value: lowerChildValue(expression, context),
      });
    }
  }
  return items;
};

const singleChildValue = (
  children: readonly ts.JsxChild[],
  context: LowerContext,
): IrValue | null => {
  for (const child of children) {
    const text = meaningfulText(child);
    if (text !== null) {
      return textWidget(text);
    }
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
      return { kind: 'widget', widget: lowerJsxElement(child, context) };
    }
  }
  return null;
};

const textContent = (children: readonly ts.JsxChild[]): string =>
  children
    .flatMap((child) => {
      const text = meaningfulText(child);
      return text === null ? [] : [text];
    })
    .join(' ');

const childrenArgument = (
  element: ts.JsxElement,
  info: WidgetInfo,
  context: LowerContext,
): IrArgument | null => {
  const childrenSlot = info.slots.children;
  if (childrenSlot === null || childrenSlot.kind === 'text') {
    return null;
  }
  const param = info.paramsByJsxName.get('children');
  const positional = param !== undefined && !param.named;

  if (childrenSlot.kind === 'widgetList') {
    return {
      param: childrenSlot.param,
      positional,
      value: {
        kind: 'widgetList',
        items: lowerListChildren(element.children, context),
      },
    };
  }
  const value = singleChildValue(element.children, context);
  return value === null
    ? null
    : { param: childrenSlot.param, positional, value };
};

const lowerJsxElement = (
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  context: LowerContext,
): IrWidget => {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  const widgetName = opening.tagName.getText();
  const info = context.compile.widgets.get(widgetName);
  if (info === undefined) {
    throw tsxErrorAt(
      'TSX0201',
      `unknown widget <${widgetName}>: not a Flutter widget extracted from ` +
        'the SDK.',
      { sourceFile: context.sourceFile, node: opening.tagName },
    );
  }

  const args: IrArgument[] = [];
  const childrenSlot = info.slots.children;
  if (childrenSlot?.kind === 'text' && ts.isJsxElement(element)) {
    args.push({
      param: childrenSlot.param,
      positional: true,
      value: { kind: 'string', value: textContent(element.children) },
    });
  }
  for (const attribute of opening.attributes.properties) {
    if (ts.isJsxAttribute(attribute)) {
      args.push(lowerAttribute(attribute, info, context));
    }
  }
  if (ts.isJsxElement(element)) {
    const children = childrenArgument(element, info, context);
    if (children !== null) {
      args.push(children);
    }
  }
  return { name: widgetName, args };
};

export const lowerComponent = (
  component: ComponentAnalysis,
  compile: CompileContext,
): IrComponent => {
  const context: LowerContext = {
    compile,
    sourceFile: component.sourceFile,
    stateNames: new Set(component.states.map((state) => state.name)),
    handlerNames: new Set(component.handlers.map((handler) => handler.name)),
  };

  const root = component.returnJsx;
  if (!ts.isJsxElement(root) && !ts.isJsxSelfClosingElement(root)) {
    throw tsxErrorAt('TSX0204', 'a component must return a widget element.', {
      sourceFile: component.sourceFile,
      node: root,
    });
  }

  const isStateful =
    component.states.length > 0 ||
    component.plugins.length > 0 ||
    component.effects.length > 0;

  return {
    name: component.name,
    kind: isStateful ? 'stateful' : 'stateless',
    states: component.states,
    plugins: component.plugins,
    handlers: component.handlers,
    effects: component.effects,
    body: lowerJsxElement(root, context),
  };
};
