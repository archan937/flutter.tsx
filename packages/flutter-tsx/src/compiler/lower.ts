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
import type { PluginMethod } from '../plugins/api';
import type { DerivedHook } from '../plugins/hooks';
import type { ComponentAnalysis, PluginBinding } from './analyze';
import { tsxErrorAt } from './diagnostics';
import type {
  IrArgument,
  IrChild,
  IrComponent,
  IrField,
  IrMethod,
  IrStatement,
  IrValue,
  IrWidget,
} from './ir';
import {
  type PluginReadInfo,
  type TranslateContext,
  translateExpression,
  translateIdentifier,
} from './translate';

interface WidgetInfo {
  name: string;
  library: string;
  constConstructor: boolean;
  paramsByJsxName: Map<string, ParamModel>;
  requiredOneOf: string[][];
  slots: WidgetSlots;
}

export interface PluginHookInfo {
  hook: DerivedHook;
  methods: Map<string, PluginMethod>;
  fields: Map<string, TypeNode>;
}

export interface PluginFunctionInfo {
  fn: PluginMethod;
  dartImport: string;
}

export interface CompileContext {
  widgets: Map<string, WidgetInfo>;
  // Everything needed to wrap a widget in a GestureDetector, derived from the
  // detector itself so the prop set and the wrapper can never disagree.
  gestures: GestureWrap | null;
  userWidgets: Map<string, WidgetInfo>;
  pluginHooks: Map<string, PluginHookInfo>;
  pluginFunctions: Map<string, PluginFunctionInfo>;
  pluginEnums: Map<string, Set<string>>;
  enums: Map<string, Set<string>>;
  forms: ValueForms;
  constantOwners: Map<string, Set<string>>;
  libraries: Map<string, string>;
  exports: Map<string, string[]>;
}

const EMPTY_SLOTS: WidgetSlots = { children: null, slots: [] };

const GESTURE_WIDGET = 'GestureDetector';

interface GestureWrap {
  props: Map<string, ParamModel>;
  childParam: string;
  constConstructor: boolean;
}

// The detector's callback params are exactly the gestures Flutter recognises;
// deriving them means a new SDK gesture needs no code change here.
const gestureWrapOf = (
  detector: WidgetInfo | undefined,
): GestureWrap | null => {
  const childSlot = detector?.slots.children;
  if (detector === undefined || childSlot?.kind !== 'widget') {
    return null;
  }
  const props = new Map<string, ParamModel>();
  for (const [jsxName, param] of detector.paramsByJsxName) {
    const bare = param.type.kind === 'nullable' ? param.type.inner : param.type;
    if (param.name.startsWith('on') && bare.kind === 'function') {
      props.set(jsxName, param);
    }
  }
  return props.size === 0
    ? null
    : {
        props,
        childParam: childSlot.param,
        constConstructor: detector.constConstructor,
      };
};

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
      requiredOneOf: constructor.requiredOneOf,
      slots: slots[entity.name] ?? EMPTY_SLOTS,
    });
  }

  return {
    widgets,
    gestures: gestureWrapOf(widgets.get(GESTURE_WIDGET)),
    userWidgets: new Map(),
    pluginHooks: new Map(),
    pluginFunctions: new Map(),
    pluginEnums: new Map(),
    enums,
    forms: deriveValueForms(snapshot),
    constantOwners,
    libraries,
    exports: new Map(Object.entries(snapshot.exports)),
  };
};

const PROP_TYPE_NODES: Record<string, TypeNode> = {
  String: { kind: 'scalar', name: 'String' },
  double: { kind: 'scalar', name: 'double' },
  bool: { kind: 'scalar', name: 'bool' },
};

export const buildUserWidgets = (
  components: ComponentAnalysis[],
): Map<string, WidgetInfo> =>
  new Map(
    components.map((component) => [
      component.name,
      {
        name: component.name,
        library: '',
        constConstructor: true,
        requiredOneOf: [],
        paramsByJsxName: new Map(
          component.props.map((prop) => [
            prop.name,
            {
              name: prop.name,
              type: PROP_TYPE_NODES[prop.dartType] ?? { kind: 'unknown' },
              display: prop.dartType,
              named: true,
              required: prop.required,
              defaultValue: null,
              doc: '',
              deprecated: false,
            },
          ]),
        ),
        slots: EMPTY_SLOTS,
      },
    ]),
  );

interface LowerContext {
  compile: CompileContext;
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  handlerNames: Set<string>;
  stringStates: Set<string>;
  stringLocals: Set<string>;
  pluginBindings: Map<string, PluginHookInfo>;
  usedPluginImports: Set<string>;
  settersToStates: Map<string, string>;
  stateDartTypes: Map<string, string>;
  translate: TranslateContext;
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

// Vision rule 4: a fragment root wraps its children in a Column.
const columnOf = (items: IrChild[], context: LowerContext): IrWidget => ({
  name: 'Column',
  constConstructor:
    context.compile.widgets.get('Column')?.constConstructor ?? true,
  args: [
    {
      param: 'children',
      positional: false,
      value: { kind: 'widgetList', items },
    },
  ],
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
  const params = type.params.map((_, index) => {
    const name = arrow.parameters[index]?.name.getText() ?? '_';
    return name.startsWith('_') ? '_' : name;
  });
  return {
    kind: 'closure',
    params,
    statements: lowerBodyStatements(arrow.body, context),
  };
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

  return {
    param: param.name,
    positional: !param.named,
    value: lowerAttributeValue(attribute, param, context),
  };
};

const lowerAttributeValue = (
  attribute: ts.JsxAttribute,
  param: ParamModel,
  context: LowerContext,
): IrValue => {
  const { initializer } = attribute;
  if (initializer === undefined) {
    return lowerBoolean(true, {
      type: unwrapType(param.type),
      node: attribute.name,
      context,
    });
  }
  if (ts.isStringLiteral(initializer)) {
    return lowerString(initializer.text, {
      type: unwrapType(param.type),
      node: initializer,
      context,
    });
  }
  if (ts.isJsxExpression(initializer) && initializer.expression !== undefined) {
    return lowerExpression(initializer.expression, param.type, context);
  }
  return { kind: 'raw', node: initializer };
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

const textValueWidget = (value: IrValue, context: LowerContext): IrValue => ({
  kind: 'widget',
  widget: {
    name: 'Text',
    constConstructor:
      context.compile.widgets.get('Text')?.constConstructor ?? true,
    args: [{ param: 'data', positional: true, value }],
  },
});

// The DX contract: strings and numbers are valid children anywhere — scalar
// expressions wrap in a Text, interpolated unless already a string.
const lowerScalarChild = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue => {
  if (ts.isStringLiteral(expression)) {
    return textWidget(expression.text, context);
  }
  const dart = translateExpression(expression, context.translate);
  if (isStringExpression(expression, context)) {
    return textValueWidget({ kind: 'dartExpr', dart }, context);
  }

  return textValueWidget(
    { kind: 'interpolation', parts: [{ kind: 'expr', value: dart }] },
    context,
  );
};

const lowerChildValue = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue => {
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
    return { kind: 'widget', widget: lowerJsxElement(expression, context) };
  }
  if (ts.isConditionalExpression(expression)) {
    return {
      kind: 'conditional',
      condition: ts.isIdentifier(expression.condition)
        ? lowerIdentifier(expression.condition, context)
        : {
            kind: 'dartExpr',
            dart: translateExpression(expression.condition, context.translate),
          },
      whenTrue: lowerChildValue(expression.whenTrue, context),
      whenFalse: lowerChildValue(expression.whenFalse, context),
    };
  }
  return lowerScalarChild(expression, context);
};

const unwrapParenthesized = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression)
    ? unwrapParenthesized(expression.expression)
    : expression;

const elementDartType = (listDartType: string | undefined): string | null => {
  const match = listDartType?.match(/^List<(.+)>$/);
  return match?.[1] ?? null;
};

const lowerMapChild = (
  call: ts.CallExpression,
  context: LowerContext,
): IrChild | null => {
  const callee = call.expression;
  if (
    !ts.isPropertyAccessExpression(callee) ||
    callee.name.text !== 'map' ||
    call.arguments.length !== 1
  ) {
    return null;
  }
  const [mapper] = call.arguments;
  if (
    mapper === undefined ||
    !ts.isArrowFunction(mapper) ||
    mapper.parameters.length !== 1
  ) {
    return null;
  }
  const itemName = mapper.parameters[0]?.name.getText() ?? '';
  if (ts.isBlock(mapper.body)) {
    return null;
  }
  const body = unwrapParenthesized(mapper.body);

  const iterable = ts.isIdentifier(callee.expression)
    ? lowerIdentifier(callee.expression, context)
    : {
        kind: 'dartExpr' as const,
        dart: translateExpression(callee.expression, context.translate),
      };
  const itemType =
    ts.isIdentifier(callee.expression) &&
    elementDartType(context.stateDartTypes.get(callee.expression.text));
  const bodyContext: LowerContext = {
    ...context,
    stringLocals:
      itemType === 'String'
        ? new Set([...context.stringLocals, itemName])
        : context.stringLocals,
  };
  return {
    kind: 'for',
    itemName,
    iterable,
    child: { kind: 'value', value: lowerChildValue(body, bodyContext) },
  };
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
    if (ts.isJsxFragment(child)) {
      items.push(...lowerListChildren(child.children, context));
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
      const mapped = ts.isCallExpression(expression)
        ? lowerMapChild(expression, context)
        : null;
      if (mapped !== null) {
        items.push(mapped);
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
    if (ts.isJsxExpression(child) && child.expression !== undefined) {
      return lowerChildValue(child.expression, context);
    }
  }
  return null;
};

const jsxTextValue = (child: ts.JsxText): string =>
  child.text.replace(/\s*\n\s*/g, '');

const isStringExpression = (
  expression: ts.Expression,
  context: LowerContext,
): boolean => {
  if (ts.isStringLiteral(expression) || ts.isTemplateLiteral(expression)) {
    return true;
  }
  if (ts.isIdentifier(expression)) {
    return (
      context.stringStates.has(expression.text) ||
      context.stringLocals.has(expression.text)
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return (
      isStringExpression(expression.whenTrue, context) &&
      isStringExpression(expression.whenFalse, context)
    );
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const field = context.translate.pluginReads
      .get(expression.expression.text)
      ?.fields.get(expression.name.text);
    return field?.kind === 'scalar' && field.name === 'String';
  }
  return false;
};

const textSlotValue = (
  children: readonly ts.JsxChild[],
  context: LowerContext,
): IrValue => {
  const parts: { kind: 'text' | 'expr'; value: string }[] = [];
  const expressions: ts.Expression[] = [];
  for (const child of children) {
    if (ts.isJsxText(child)) {
      const value = jsxTextValue(child);
      if (value !== '') {
        parts.push({ kind: 'text', value });
      }
      continue;
    }
    if (ts.isJsxExpression(child) && child.expression !== undefined) {
      expressions.push(child.expression);
      parts.push({
        kind: 'expr',
        value: translateExpression(child.expression, context.translate),
      });
    }
  }
  if (parts.every((part) => part.kind === 'text')) {
    return {
      kind: 'string',
      value: parts.map((part) => part.value).join(' '),
    };
  }
  const [only] = expressions;
  if (
    parts.length === 1 &&
    only !== undefined &&
    isStringExpression(only, context)
  ) {
    return {
      kind: 'dartExpr',
      dart: translateExpression(only, context.translate),
    };
  }
  return { kind: 'interpolation', parts };
};

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
  const info =
    context.compile.widgets.get(widgetName) ??
    context.compile.userWidgets.get(widgetName);
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
      value: textSlotValue(element.children, context),
    });
  }
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
  const gestureArgs: IrArgument[] = [];
  for (const attribute of opening.attributes.properties) {
    if (!ts.isJsxAttribute(attribute)) {
      continue;
    }
    const jsxName = attribute.name.getText();
    const gesture = info.paramsByJsxName.has(jsxName)
      ? undefined
      : context.compile.gestures?.props.get(jsxName);
    if (gesture !== undefined) {
      gestureArgs.push(lowerGestureAttribute(attribute, gesture, context));
      continue;
    }
    args.push(lowerAttribute(attribute, info, context));
  }
  if (ts.isJsxElement(element)) {
    const children = childrenArgument(element, info, context);
    if (children !== null) {
      args.push(children);
    }
  }
  requireOneOfSatisfied({ info, args, node: opening.tagName }, context);
  const widget: IrWidget = {
    name: widgetName,
    constConstructor: info.constConstructor,
    args,
  };
  const wrap = context.compile.gestures;
  return gestureArgs.length === 0 || wrap === null
    ? widget
    : wrapInGestureDetector(widget, gestureArgs, wrap);
};

const lowerGestureAttribute = (
  attribute: ts.JsxAttribute,
  param: ParamModel,
  context: LowerContext,
): IrArgument => ({
  param: param.name,
  positional: false,
  value: lowerAttributeValue(attribute, param, context),
});

// Only reachable when a gesture prop matched, which means the wrap data came
// from the same derivation — no impossible branch to guard.
const wrapInGestureDetector = (
  widget: IrWidget,
  gestureArgs: IrArgument[],
  wrap: GestureWrap,
): IrWidget => ({
  name: GESTURE_WIDGET,
  constConstructor: wrap.constConstructor,
  args: [
    ...gestureArgs,
    {
      param: wrap.childParam,
      positional: false,
      value: { kind: 'widget', widget },
    },
  ],
});

const orList = (names: string[]): string => {
  const quoted = names.map((name) => `\`${name}\``);
  const last = quoted.pop() ?? '';
  return quoted.length === 0 ? last : `${quoted.join(', ')} or ${last}`;
};

// Flutter states some requirements only in a constructor assert, where no
// optional-param type can carry them. Catch them here so the error lands on
// the TSX instead of on generated Dart that throws at runtime.
const requireOneOfSatisfied = (
  widget: { info: WidgetInfo; args: IrArgument[]; node: ts.Node },
  context: LowerContext,
): void => {
  const { info, args, node } = widget;
  if (info.requiredOneOf.length === 0) {
    return;
  }
  const supplied = new Set(args.map((argument) => argument.param));
  for (const group of info.requiredOneOf) {
    if (group.some((name) => supplied.has(name))) {
      continue;
    }
    throw tsxErrorAt(
      'TSX0317',
      `\`${info.name}\` needs one of ${orList(group)}: Flutter asserts it ` +
        'at runtime, so leaving all of them out compiles to Dart that throws.',
      { sourceFile: context.sourceFile, node },
    );
  }
};

const setterAssignment = (
  call: ts.CallExpression,
  stateName: string,
  context: LowerContext,
): string => {
  const argument = call.arguments[0];
  if (argument === undefined) {
    throw tsxErrorAt(
      'TSX0305',
      'this statement is not compiled yet (roadmap step 18).',
      { sourceFile: context.sourceFile, node: call },
    );
  }
  const member = translateIdentifier(stateName, context.translate);
  if (
    ts.isBinaryExpression(argument) &&
    ts.isIdentifier(argument.left) &&
    argument.left.text === stateName
  ) {
    const operator = argument.operatorToken.kind;
    const { right } = argument;
    const rightIsOne = ts.isNumericLiteral(right) && right.text === '1';
    if (operator === ts.SyntaxKind.PlusToken) {
      return rightIsOne
        ? `${member}++`
        : `${member} += ${translateExpression(right, context.translate)}`;
    }
    if (operator === ts.SyntaxKind.MinusToken) {
      return rightIsOne
        ? `${member}--`
        : `${member} -= ${translateExpression(right, context.translate)}`;
    }
  }
  return `${member} = ${translateExpression(argument, context.translate)}`;
};

const lowerBodyStatements = (
  body: ts.ConciseBody,
  context: LowerContext,
  allowPluginCalls = false,
): IrStatement[] => {
  const items: { expression: ts.Expression | undefined; errorNode: ts.Node }[] =
    ts.isBlock(body)
      ? body.statements.map((statement) => ({
          expression: ts.isExpressionStatement(statement)
            ? statement.expression
            : undefined,
          errorNode: statement,
        }))
      : [{ expression: body, errorNode: body }];

  const lowered: IrStatement[] = [];
  for (const { expression, errorNode } of items) {
    const pluginLine =
      allowPluginCalls && expression !== undefined
        ? pluginCallLine(expression, context, errorNode)
        : null;
    if (pluginLine !== null) {
      lowered.push({ kind: 'dart', line: pluginLine });
      continue;
    }
    const stateName =
      expression !== undefined &&
      ts.isCallExpression(expression) &&
      ts.isIdentifier(expression.expression)
        ? context.settersToStates.get(expression.expression.text)
        : undefined;
    if (
      expression === undefined ||
      !ts.isCallExpression(expression) ||
      stateName === undefined
    ) {
      throw tsxErrorAt(
        'TSX0305',
        'this statement is not compiled yet (roadmap step 18).',
        { sourceFile: context.sourceFile, node: errorNode },
      );
    }
    const assignment = setterAssignment(expression, stateName, context);
    const previous = lowered[lowered.length - 1];
    if (previous?.kind === 'setState') {
      previous.assignments.push(assignment);
    } else {
      lowered.push({ kind: 'setState', assignments: [assignment] });
    }
  }
  return lowered;
};

const pluginCallLine = (
  expression: ts.Expression,
  context: LowerContext,
  errorNode: ts.Node,
): string | null => {
  const awaited = ts.isAwaitExpression(expression);
  const call = awaited ? expression.expression : expression;
  if (!ts.isCallExpression(call)) {
    return null;
  }
  const prefix = awaited ? 'await ' : '';
  if (ts.isIdentifier(call.expression)) {
    const fnInfo = context.compile.pluginFunctions.get(call.expression.text);
    if (fnInfo === undefined) {
      return null;
    }
    context.usedPluginImports.add(fnInfo.dartImport);
    return statementCall(
      `${prefix}${fnInfo.fn.name}`,
      pluginCallArguments(call, fnInfo.fn, context),
    );
  }
  if (
    !ts.isPropertyAccessExpression(call.expression) ||
    !ts.isIdentifier(call.expression.expression)
  ) {
    return null;
  }
  const binding = call.expression.expression.text;
  const info = context.pluginBindings.get(binding);
  if (info === undefined) {
    return null;
  }
  const methodName = call.expression.name.text;
  const method = info.methods.get(methodName);
  if (method === undefined) {
    throw tsxErrorAt(
      'TSX0312',
      `${info.hook.className} has no method \`${methodName}\`. Check the ` +
        'API reference for the available methods.',
      { sourceFile: context.sourceFile, node: errorNode },
    );
  }
  const accessor = info.hook.acquisition.kind === 'constField' ? '.' : '?.';
  return statementCall(
    `${prefix}_${binding}${accessor}${methodName}`,
    pluginCallArguments(call, method, context),
  );
};

// Statement-position invocations sit at method-body indent (4): inline when
// the whole call fits 80 columns, else one argument per line — the dart
// format canonical split.
const statementCall = (invocation: string, args: string[]): string => {
  const inline = `${invocation}(${args.join(', ')});`;
  if (4 + inline.length <= 80) {
    return inline;
  }
  return [
    `${invocation}(`,
    ...args.map((argument) => `  ${argument},`),
    ');',
  ].join('\n');
};

const bareType = (type: TypeNode | undefined): TypeNode | undefined =>
  type?.kind === 'nullable' ? type.inner : type;

// Dart-type-directed rendering: core Uri params accept a plain string
// (wrapped in Uri.parse) and enum params accept the member name.
const pluginArgumentValue = (
  argument: ts.Expression,
  param: ParamModel | undefined,
  context: LowerContext,
): string => {
  const paramType = bareType(param?.type);
  if (paramType?.kind === 'named' && paramType.name === 'Uri') {
    return `Uri.parse(${translateExpression(argument, context.translate)})`;
  }
  if (paramType?.kind === 'enum' && ts.isStringLiteralLike(argument)) {
    const members = context.compile.pluginEnums.get(paramType.name);
    if (members !== undefined && !members.has(argument.text)) {
      throw tsxErrorAt(
        'TSX0203',
        `\`${argument.text}\` is not a ${paramType.name} member.`,
        { sourceFile: context.sourceFile, node: argument },
      );
    }
    return `${paramType.name}.${argument.text}`;
  }
  return translateExpression(argument, context.translate);
};

// A trailing object literal maps onto the Dart method's named parameters —
// the same call shape the generated typings advertise.
const pluginCallArguments = (
  call: ts.CallExpression,
  method: PluginMethod,
  context: LowerContext,
): string[] => {
  const namedParams = new Map(
    method.params
      .filter((param) => param.named)
      .map((param) => [param.name, param]),
  );
  const positionalParams = method.params.filter((param) => !param.named);
  const rendered: string[] = [];
  let positionalIndex = 0;
  for (const [index, argument] of call.arguments.entries()) {
    const isTrailingObject =
      index === call.arguments.length - 1 &&
      ts.isObjectLiteralExpression(argument) &&
      namedParams.size > 0;
    if (!isTrailingObject || !ts.isObjectLiteralExpression(argument)) {
      rendered.push(
        pluginArgumentValue(
          argument,
          positionalParams[positionalIndex],
          context,
        ),
      );
      positionalIndex += 1;
      continue;
    }
    for (const entry of objectEntries(argument, 'TSX0206', context)) {
      const param = namedParams.get(entry.key);
      if (param === undefined) {
        throw tsxErrorAt(
          'TSX0314',
          `\`${method.name}\` has no named argument \`${entry.key}\`. ` +
            'Check the API reference for the available arguments.',
          { sourceFile: context.sourceFile, node: entry.node },
        );
      }
      rendered.push(
        `${entry.key}: ${pluginArgumentValue(entry.initializer, param, context)}`,
      );
    }
  }
  return rendered;
};

const lowerEffects = (
  effects: ts.CallExpression[],
  context: LowerContext,
): IrStatement[] =>
  effects.flatMap((effect) => {
    const [body, dependencies] = effect.arguments;
    if (
      body === undefined ||
      !ts.isArrowFunction(body) ||
      dependencies === undefined ||
      !ts.isArrayLiteralExpression(dependencies) ||
      dependencies.elements.length > 0
    ) {
      throw tsxErrorAt(
        'TSX0306',
        'only mount effects compile: pass an empty dependency array ' +
          '(`useEffect(() => { ... }, [])`).',
        { sourceFile: context.sourceFile, node: effect },
      );
    }
    if (ts.isBlock(body.body)) {
      const cleanup = body.body.statements.find((statement) =>
        ts.isReturnStatement(statement),
      );
      if (cleanup !== undefined) {
        throw tsxErrorAt(
          'TSX0307',
          'effect cleanups land with plugin controllers (roadmap step 22).',
          { sourceFile: context.sourceFile, node: cleanup },
        );
      }
    }
    return lowerBodyStatements(body.body, context);
  });

const capitalize = (name: string): string =>
  name === '' ? name : `${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`;

const lowerFirst = (name: string): string =>
  name === '' ? name : `${name[0]?.toLowerCase() ?? ''}${name.slice(1)}`;

const supplierLocalName = (functionName: string, paramType: string): string =>
  functionName.startsWith('available')
    ? lowerFirst(functionName.slice('available'.length))
    : `${lowerFirst(paramType)}s`;

interface LoweredPlugin {
  field: IrField;
  setup: { name: string; lines: string[] } | null;
  initCall: IrStatement | null;
  disposeLine: string | null;
  pluginImport: string;
}

const hookOptionSelections = (
  binding: PluginBinding,
  info: PluginHookInfo,
  context: LowerContext,
): Map<string, string> => {
  const selections = new Map<string, string>();
  const [argument] = binding.call.arguments;
  if (argument === undefined) {
    return selections;
  }
  if (!ts.isObjectLiteralExpression(argument)) {
    throw tsxErrorAt(
      'TSX0206',
      'object values must use plain `key: value` properties.',
      { sourceFile: context.sourceFile, node: argument },
    );
  }
  const optionsByName = new Map(
    info.hook.options.map((option) => [option.name, option]),
  );
  for (const entry of objectEntries(argument, 'TSX0206', context)) {
    const option = optionsByName.get(entry.key);
    if (option === undefined) {
      throw tsxErrorAt(
        'TSX0313',
        `${info.hook.hookName} has no option \`${entry.key}\`.`,
        { sourceFile: context.sourceFile, node: entry.node },
      );
    }
    if (
      !ts.isStringLiteral(entry.initializer) ||
      !option.values.includes(entry.initializer.text)
    ) {
      throw tsxErrorAt(
        'TSX0203',
        `\`${entry.initializer.getText().replaceAll("'", '')}\` is not a ` +
          `${option.enumName} member.`,
        { sourceFile: context.sourceFile, node: entry.node },
      );
    }
    selections.set(entry.key, entry.initializer.text);
  }
  return selections;
};

// dart format keeps a single predicate on the closure line and wraps a
// conjunction onto continuation lines indented four past the closure body.
const selectionLines = (
  paramName: string,
  collection: string,
  predicates: string[],
): string[] => {
  const [single] = predicates;
  const head =
    predicates.length === 1 && single !== undefined
      ? [`  (candidate) => ${single},`]
      : [
          '  (candidate) =>',
          ...predicates.map(
            (predicate, index) =>
              `      ${predicate}${index === predicates.length - 1 ? ',' : ' &&'}`,
          ),
        ];
  return [
    `final ${paramName} = ${collection}.firstWhere(`,
    ...head,
    `  orElse: () => ${collection}.first,`,
    ');',
  ];
};

const constructLines = (className: string, args: string[]): string[] => {
  const inline = `final controller = ${className}(${args.join(', ')});`;
  if (4 + inline.length <= 80) {
    return [inline];
  }
  return [
    `final controller = ${className}(`,
    ...args.map((argument) => `  ${argument},`),
    ');',
  ];
};

const constructorSetupLines = (
  binding: PluginBinding,
  info: PluginHookInfo,
  context: LowerContext,
): string[] => {
  const fieldName = `_${binding.binding}`;
  const selections = hookOptionSelections(binding, info, context);
  const constructArgs: string[] = [];
  const lines: string[] = [];
  for (const arg of info.hook.construct) {
    if (arg.kind === 'supplierFirst') {
      const local = supplierLocalName(arg.functionName, arg.paramType);
      lines.push(`final ${local} = await ${arg.functionName}();`);
      const chosen = arg.filters
        .filter((filter) => selections.has(filter.optionName))
        .map((filter) => {
          const member = selections.get(filter.optionName) ?? '';
          return `candidate.${filter.fieldName} == ${filter.enumName}.${member}`;
        });
      if (chosen.length === 0) {
        constructArgs.push(`${local}.first`);
      } else {
        lines.push(...selectionLines(arg.paramName, local, chosen));
        constructArgs.push(arg.paramName);
      }
    } else {
      const member = selections.get(arg.optionName) ?? arg.member;
      constructArgs.push(`${arg.enumName}.${member}`);
    }
  }
  lines.push(
    ...constructLines(info.hook.className, constructArgs),
    'await controller.initialize();',
    'if (!mounted) {',
    '  await controller.dispose();',
    '  return;',
    '}',
    'setState(() {',
    `  ${fieldName} = controller;`,
    '});',
  );
  return lines;
};

const singletonSetupLines = (
  binding: PluginBinding,
  info: PluginHookInfo,
  method: string,
): string[] => [
  `final instance = await ${info.hook.className}.${method}();`,
  'if (!mounted) {',
  '  return;',
  '}',
  'setState(() {',
  `  _${binding.binding} = instance;`,
  '});',
];

const lowerPluginBinding = (
  binding: PluginBinding,
  info: PluginHookInfo,
  context: LowerContext,
): LoweredPlugin => {
  const fieldName = `_${binding.binding}`;
  const { acquisition } = info.hook;

  if (acquisition.kind === 'constField') {
    const constPrefix = acquisition.isConst ? 'const ' : '';
    return {
      field: {
        name: fieldName,
        dartType: info.hook.className,
        mutable: false,
        initializer: `${constPrefix}${info.hook.className}()`,
      },
      setup: null,
      initCall: null,
      disposeLine: null,
      pluginImport: info.hook.dartImport,
    };
  }

  const lines =
    acquisition.kind === 'staticFactory'
      ? singletonSetupLines(binding, info, acquisition.method)
      : constructorSetupLines(binding, info, context);

  const setupName = `init${capitalize(binding.binding)}`;
  return {
    field: {
      name: fieldName,
      dartType: `${info.hook.className}?`,
      mutable: true,
      initializer: null,
    },
    setup: { name: setupName, lines },
    initCall: { kind: 'dart', line: `_${setupName}();` },
    disposeLine: info.hook.managed.includes('dispose')
      ? `${fieldName}?.dispose();`
      : null,
    pluginImport: info.hook.dartImport,
  };
};

export const lowerComponent = (
  component: ComponentAnalysis,
  compile: CompileContext,
): IrComponent => {
  const pluginReads = new Map<string, PluginReadInfo>();
  const stateNames = new Set(component.states.map((state) => state.name));
  const handlerNames = new Set(
    component.handlers.map((handler) => handler.name),
  );
  const context: LowerContext = {
    compile,
    sourceFile: component.sourceFile,
    stateNames,
    handlerNames,
    stringStates: new Set(
      component.states
        .filter((state) => state.dartType === 'String')
        .map((state) => state.name),
    ),
    stringLocals: new Set(
      component.props
        .filter((prop) => prop.dartType === 'String')
        .map((prop) => prop.name),
    ),
    pluginBindings: new Map(),
    usedPluginImports: new Set(),
    stateDartTypes: new Map(
      component.states.map((state) => [state.name, state.dartType]),
    ),
    settersToStates: new Map(
      component.states.map((state) => [state.setterName, state.name]),
    ),
    translate: {
      sourceFile: component.sourceFile,
      stateNames,
      handlerNames,
      privateMembers: true,
      pluginReads,
    },
  };

  const loweredPlugins = component.plugins.map((binding) => {
    const info = compile.pluginHooks.get(binding.hook);
    if (info === undefined) {
      throw tsxErrorAt(
        'TSX0311',
        `plugin:${binding.package} derives no \`${binding.hook}\` hook.`,
        { sourceFile: component.sourceFile, node: binding.call },
      );
    }
    context.pluginBindings.set(binding.binding, info);
    pluginReads.set(binding.binding, {
      className: info.hook.className,
      nullable: info.hook.acquisition.kind !== 'constField',
      fields: info.fields,
    });
    return {
      binding,
      lowered: lowerPluginBinding(binding, info, context),
    };
  });

  const root = component.returnJsx;
  if (
    !ts.isJsxElement(root) &&
    !ts.isJsxSelfClosingElement(root) &&
    !ts.isJsxFragment(root)
  ) {
    throw tsxErrorAt('TSX0204', 'a component must return a widget element.', {
      sourceFile: component.sourceFile,
      node: root,
    });
  }

  const isStateful =
    component.states.length > 0 ||
    component.plugins.length > 0 ||
    component.effects.length > 0;

  const methods: IrMethod[] = component.handlers.map((handler) => ({
    name: handler.name,
    isAsync: handler.isAsync,
    statements: lowerBodyStatements(handler.body.body, context, true),
  }));

  return {
    name: component.name,
    kind: isStateful ? 'stateful' : 'stateless',
    props: component.props,
    states: component.states,
    plugins: component.plugins,
    handlers: component.handlers,
    effects: component.effects,
    fields: [
      ...loweredPlugins.map(({ lowered }) => lowered.field),
      ...component.states.map((state) => ({
        name: translateIdentifier(state.name, context.translate),
        dartType: state.dartType,
        mutable: state.mutable,
        initializer: translateExpression(state.initializer, context.translate),
      })),
    ],
    methods,
    setupMethods: loweredPlugins.flatMap(({ lowered }) =>
      lowered.setup === null ? [] : [lowered.setup],
    ),
    initStatements: [
      ...loweredPlugins.flatMap(({ lowered }) =>
        lowered.initCall === null ? [] : [lowered.initCall],
      ),
      ...lowerEffects(component.effects, context),
    ],
    disposeLines: loweredPlugins.flatMap(({ lowered }) =>
      lowered.disposeLine === null ? [] : [lowered.disposeLine],
    ),
    pluginImports: [
      ...new Set([
        ...loweredPlugins.map(({ lowered }) => lowered.pluginImport),
        ...context.usedPluginImports,
      ]),
    ],
    body: ts.isJsxFragment(root)
      ? columnOf(lowerListChildren(root.children, context), context)
      : lowerJsxElement(root, context),
  };
};
