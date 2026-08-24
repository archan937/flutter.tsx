import ts from 'typescript';

import type { ApiSnapshot, ParamModel, TypeNode } from '../api/model';
import type { SlotMap, WidgetSlots } from '../derive/slots';
import {
  deriveValueForms,
  EDGE_INSETS_TYPES,
  HEX_COLOR_TYPE,
  type ValueForms,
} from '../derive/value-forms';
import { jsxPropName } from '../generate/renames';
import { tsxErrorAt } from './diagnostics';
import type { ComponentAnalysis } from './front-end';
import type { IrArgument, IrChild, IrComponent, IrValue, IrWidget } from './ir';

interface WidgetInfo {
  name: string;
  library: string;
  constConstructor: boolean;
  paramsByJsxName: Map<string, ParamModel>;
  slots: WidgetSlots;
}

export interface CompileContext {
  widgets: Map<string, WidgetInfo>;
  enums: Map<string, Set<string>>;
  forms: ValueForms;
  constantOwners: Map<string, Set<string>>;
  libraries: Map<string, string>;
  exports: Map<string, string[]>;
}

const EMPTY_SLOTS: WidgetSlots = { children: null, slots: [] };

export const buildCompileContext = (
  snapshot: ApiSnapshot,
  slots: SlotMap,
): CompileContext => {
  const widgets = new Map<string, WidgetInfo>();
  const enums = new Map<string, Set<string>>();
  const constantOwners = new Map<string, Set<string>>();
  const libraries = new Map<string, string>();

  for (const entity of snapshot.entities) {
    libraries.set(entity.name, entity.library);
    if (entity.kind === 'enum') {
      enums.set(entity.name, new Set(entity.values.map((value) => value.name)));
      continue;
    }
    if (entity.constants.length > 0) {
      constantOwners.set(
        entity.name,
        new Set(entity.constants.map((constant) => constant.name)),
      );
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
      library: entity.library,
      constConstructor: constructor.isConst && !constructor.paramMemberAsserts,
      paramsByJsxName,
      slots: slots[entity.name] ?? EMPTY_SLOTS,
    });
  }

  return {
    widgets,
    enums,
    forms: deriveValueForms(snapshot),
    constantOwners,
    libraries,
    exports: new Map(Object.entries(snapshot.exports)),
  };
};

interface LowerContext {
  compile: CompileContext;
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  handlerNames: Set<string>;
}

const SYMMETRIC_INSETS_KEYS = new Set(['horizontal', 'vertical']);
const SIDE_INSETS_KEYS = new Set(['left', 'top', 'right', 'bottom']);
const NUMBER_SCALARS = new Set(['int', 'double', 'num']);
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const unwrapType = (type: TypeNode): TypeNode =>
  type.kind === 'nullable' ? type.inner : type;

const typeLabel = (type: TypeNode): string => {
  const label =
    type.kind === 'named' || type.kind === 'enum' || type.kind === 'scalar'
      ? type.name
      : type.kind;
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a';
  return `${article} ${label}`;
};

const textWidget = (value: string, context: LowerContext): IrValue => ({
  kind: 'widget',
  widget: {
    name: 'Text',
    constConstructor:
      context.compile.widgets.get('Text')?.constConstructor ?? true,
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

const hexColorValue = (text: string): IrValue => {
  const hex = text.slice(1);
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : hex;
  const argb =
    expanded.length === 8
      ? expanded.slice(6) + expanded.slice(0, 6)
      : `FF${expanded}`;
  return {
    kind: 'construct',
    className: 'Color',
    constructorName: '',
    args: [
      {
        param: 'value',
        positional: true,
        value: { kind: 'number', value: `0x${argb.toUpperCase()}` },
      },
    ],
  };
};

interface ValueSite {
  type: TypeNode;
  node: ts.Node;
  context: LowerContext;
}

const lowerString = (text: string, site: ValueSite): IrValue => {
  const { type, node, context } = site;
  if (
    type.kind === 'unknown' ||
    (type.kind === 'scalar' && type.name === 'String')
  ) {
    return { kind: 'string', value: text };
  }
  if (type.kind === 'enum') {
    const members = context.compile.enums.get(type.name);
    if (!members?.has(text)) {
      throw tsxErrorAt('TSX0203', `\`${text}\` is not a ${type.name} member.`, {
        sourceFile: context.sourceFile,
        node,
      });
    }
    return { kind: 'enumValue', enumName: type.name, member: text };
  }
  if (type.kind === 'named') {
    if (type.name === HEX_COLOR_TYPE && text.startsWith('#')) {
      if (!HEX_COLOR_PATTERN.test(text)) {
        throw tsxErrorAt(
          'TSX0205',
          `\`${text}\` is not a hex color — use #RGB, #RRGGBB, or #RRGGBBAA.`,
          { sourceFile: context.sourceFile, node },
        );
      }
      return hexColorValue(text);
    }
    const owner = context.compile.forms.constantMembers
      .get(type.name)
      ?.get(text);
    if (owner !== undefined) {
      return { kind: 'constantRef', owner, member: text };
    }
  }
  throw tsxErrorAt(
    'TSX0205',
    `\`${text}\` cannot express ${typeLabel(type)} value.`,
    { sourceFile: context.sourceFile, node },
  );
};

const lowerNumber = (text: string, site: ValueSite): IrValue => {
  const { type, node, context } = site;
  if (
    type.kind === 'unknown' ||
    (type.kind === 'scalar' && NUMBER_SCALARS.has(type.name))
  ) {
    return { kind: 'number', value: text };
  }
  if (type.kind === 'named' && EDGE_INSETS_TYPES.has(type.name)) {
    return {
      kind: 'construct',
      className: 'EdgeInsets',
      constructorName: 'all',
      args: [
        {
          param: 'value',
          positional: true,
          value: { kind: 'number', value: text },
        },
      ],
    };
  }
  throw tsxErrorAt(
    'TSX0205',
    `\`${text}\` cannot express ${typeLabel(type)} value.`,
    { sourceFile: context.sourceFile, node },
  );
};

const lowerBoolean = (value: boolean, site: ValueSite): IrValue => {
  const { type, node, context } = site;
  if (
    type.kind === 'unknown' ||
    (type.kind === 'scalar' && type.name === 'bool')
  ) {
    return { kind: 'boolean', value };
  }
  throw tsxErrorAt(
    'TSX0205',
    `\`${String(value)}\` cannot express ${typeLabel(type)} value.`,
    { sourceFile: context.sourceFile, node },
  );
};

interface ObjectEntry {
  key: string;
  initializer: ts.Expression;
  node: ts.Node;
}

const objectEntries = (
  literal: ts.ObjectLiteralExpression,
  code: 'TSX0206' | 'TSX0207',
  context: LowerContext,
): ObjectEntry[] =>
  literal.properties.map((property) => {
    if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
      return {
        key: property.name.text,
        initializer: property.initializer,
        node: property.name,
      };
    }
    if (ts.isShorthandPropertyAssignment(property)) {
      return {
        key: property.name.text,
        initializer: property.name,
        node: property.name,
      };
    }
    throw tsxErrorAt(
      code,
      'object values must use plain `key: value` properties.',
      { sourceFile: context.sourceFile, node: property },
    );
  });

const lowerInsetsObject = (
  literal: ts.ObjectLiteralExpression,
  context: LowerContext,
): IrValue => {
  const entries = objectEntries(literal, 'TSX0206', context);
  const keys = entries.map((entry) => entry.key);
  const constructorName = keys.every((key) => SYMMETRIC_INSETS_KEYS.has(key))
    ? 'symmetric'
    : keys.every((key) => SIDE_INSETS_KEYS.has(key))
      ? 'only'
      : null;
  if (entries.length === 0 || constructorName === null) {
    throw tsxErrorAt(
      'TSX0206',
      'edge insets take `{horizontal?, vertical?}` or ' +
        '`{left?, top?, right?, bottom?}` (numbers).',
      { sourceFile: context.sourceFile, node: literal },
    );
  }
  return {
    kind: 'construct',
    className: 'EdgeInsets',
    constructorName,
    args: entries.map((entry) => ({
      param: entry.key,
      positional: false,
      value: lowerExpression(
        entry.initializer,
        { kind: 'scalar', name: 'double' },
        context,
      ),
    })),
  };
};

const lowerConstructibleObject = (
  literal: ts.ObjectLiteralExpression,
  typeName: string,
  site: { params: ParamModel[]; context: LowerContext },
): IrValue => {
  const { params, context } = site;
  const paramsByName = new Map(params.map((param) => [param.name, param]));
  const entries = objectEntries(literal, 'TSX0207', context);
  return {
    kind: 'construct',
    className: typeName,
    constructorName: '',
    args: entries.map((entry) => {
      const param = paramsByName.get(entry.key);
      if (param === undefined) {
        throw tsxErrorAt(
          'TSX0207',
          `${typeName} has no \`${entry.key}\` property. Check the API ` +
            'reference for the available properties.',
          { sourceFile: context.sourceFile, node: entry.node },
        );
      }
      return {
        param: param.name,
        positional: false,
        value: lowerExpression(entry.initializer, param.type, context),
      };
    }),
  };
};

const lowerObjectLiteral = (
  literal: ts.ObjectLiteralExpression,
  type: TypeNode,
  context: LowerContext,
): IrValue => {
  if (type.kind === 'named') {
    if (EDGE_INSETS_TYPES.has(type.name)) {
      return lowerInsetsObject(literal, context);
    }
    const params = context.compile.forms.constructibles.get(type.name);
    if (params !== undefined) {
      return lowerConstructibleObject(literal, type.name, { params, context });
    }
  }
  throw tsxErrorAt(
    'TSX0205',
    `an object literal cannot express ${typeLabel(type)} value.`,
    { sourceFile: context.sourceFile, node: literal },
  );
};

const lowerPropertyAccess = (
  expression: ts.PropertyAccessExpression,
  context: LowerContext,
): IrValue => {
  if (
    ts.isIdentifier(expression.expression) &&
    ts.isIdentifier(expression.name) &&
    context.compile.constantOwners
      .get(expression.expression.text)
      ?.has(expression.name.text) === true
  ) {
    return {
      kind: 'constantRef',
      owner: expression.expression.text,
      member: expression.name.text,
    };
  }
  return { kind: 'raw', node: expression };
};

const lowerArrowFunction = (
  arrow: ts.ArrowFunction,
  site: ValueSite,
): IrValue => {
  const { type, context } = site;
  if (type.kind !== 'function') {
    throw tsxErrorAt(
      'TSX0205',
      `a function cannot express ${typeLabel(type)} value.`,
      { sourceFile: context.sourceFile, node: arrow },
    );
  }
  if (!ts.isBlock(arrow.body) || arrow.body.statements.length > 0) {
    throw tsxErrorAt(
      'TSX0302',
      'inline handler bodies are not compiled yet (roadmap step 18) — ' +
        'extract the logic into a named handler.',
      { sourceFile: context.sourceFile, node: arrow.body },
    );
  }
  const params = type.params.map((_, index) => {
    const name = arrow.parameters[index]?.name.getText() ?? '_';
    return name.startsWith('_') ? '_' : name;
  });
  return { kind: 'closure', params };
};

const lowerExpression = (
  expression: ts.Expression,
  paramType: TypeNode,
  context: LowerContext,
): IrValue => {
  const type = unwrapType(paramType);
  const site: ValueSite = { type, node: expression, context };
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
    return { kind: 'widget', widget: lowerJsxElement(expression, context) };
  }
  if (ts.isArrowFunction(expression)) {
    return lowerArrowFunction(expression, site);
  }
  if (ts.isNumericLiteral(expression)) {
    return lowerNumber(expression.getText(), site);
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return lowerBoolean(true, site);
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return lowerBoolean(false, site);
  }
  if (ts.isStringLiteral(expression)) {
    return lowerString(expression.text, site);
  }
  if (ts.isObjectLiteralExpression(expression)) {
    return lowerObjectLiteral(expression, type, context);
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return lowerPropertyAccess(expression, context);
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
    value = lowerBoolean(true, {
      type: unwrapType(param.type),
      node: attribute.name,
      context,
    });
  } else if (ts.isStringLiteral(initializer)) {
    value = lowerString(initializer.text, {
      type: unwrapType(param.type),
      node: initializer,
      context,
    });
  } else if (
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined
  ) {
    value = lowerExpression(initializer.expression, param.type, context);
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
      items.push({ kind: 'value', value: textWidget(text, context) });
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
      return textWidget(text, context);
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
  if (childrenSlot === null && ts.isJsxElement(element)) {
    const orphan = element.children.find(
      (child) =>
        meaningfulText(child) !== null ||
        ts.isJsxElement(child) ||
        ts.isJsxSelfClosingElement(child) ||
        (ts.isJsxExpression(child) && child.expression !== undefined),
    );
    if (orphan !== undefined) {
      throw tsxErrorAt(
        'TSX0208',
        `<${info.name}> takes no children — check its named slots in the ` +
          'API reference.',
        { sourceFile: context.sourceFile, node: orphan },
      );
    }
  }
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
  return {
    name: widgetName,
    constConstructor: info.constConstructor,
    args,
  };
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
