import ts from 'typescript';

import type {
  ApiSnapshot,
  FunctionParam,
  ParamModel,
  ScalarName,
  TypeNode,
} from '../api/model';
import { dartTypeOf as bareDartTypeOf } from '../derive/dart-types';
import type { SlotMap, WidgetSlots } from '../derive/slots';
import {
  deriveValueForms,
  EDGE_INSETS_TYPES,
  HEX_COLOR_TYPE,
  type ValueForms,
} from '../derive/value-forms';
import { jsxPropName } from '../generate/renames';
import type { PluginMethod } from '../plugins/api';
import { type DerivedHook, isNullableHandle } from '../plugins/hooks';
import type {
  AsyncBinding,
  ComponentAnalysis,
  ConstantBinding,
  HelperBinding,
  LocalBinding,
  ModelBinding,
  PluginBinding,
  RouterBinding,
  StoreBinding,
} from './analyze';
import {
  dartConstantName,
  listElementType,
  recordFieldType,
} from './dart-names';
import { printExpr } from './dart-print';
import { tsxErrorAt } from './diagnostics';
import { GO_ROUTER_IMPORT } from './emit-component';
import type {
  IrArgument,
  IrBuilderBind,
  IrChild,
  IrComponent,
  IrConstant,
  IrField,
  IrHelper,
  IrMethod,
  IrModel,
  IrOverride,
  IrRouter,
  IrStatement,
  IrStore,
  IrValue,
  IrWidget,
} from './ir';
import { irValueToDart } from './ir-to-dart';
import {
  handleNullCheck,
  type HelperSignature,
  type MemberReadInfo,
  readFieldType,
  STRING_RETURNING_METHODS,
  translateCondition,
  type TranslateContext,
  translateExpression,
  translateIdentifier,
  widenedNumberDart,
} from './translate';

export interface WidgetInfo {
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
  // Set when the package is imported with a prefix, so the call reads
  // `http.get(…)` the way the package's own documentation writes it.
  importPrefix: string | null;
}

export interface CompileContext {
  widgets: Map<string, WidgetInfo>;
  // Everything needed to wrap a widget in a GestureDetector, derived from the
  // detector itself so the prop set and the wrapper can never disagree.
  gestures: GestureWrap | null;
  // Stores declared at module level, by TSX name.
  stores: Map<string, IrStore>;
  // Fields of every class an imported plugin exposes, so a value of that type
  // can be read even when it did not come from a hook.
  pluginClassFields: Map<string, Map<string, TypeNode>>;
  // The same for the SDK's own classes, which is what a callback parameter is.
  sdkClassFields: Map<string, Map<string, TypeNode>>;
  // Models generated from this file's interfaces, by name.
  models: Map<string, IrModel>;
  // Dart type name -> prefixed name, for plugins imported with a prefix.
  prefixedTypes: Map<string, string>;
  userWidgets: Map<string, WidgetInfo>;
  /** Data this file or a sibling declares: name -> its Dart type. */
  constants: Map<string, string>;
  /** Plugin classes an object literal can construct, by name. */
  pluginConstructibles: Map<string, ParamModel[]>;
  /** Every plugin class with a constructor, and what it takes. */
  pluginConstructors: Map<string, ParamModel[]>;
  /** The static methods each plugin class declares, by class then name. */
  pluginStatics: Map<string, Map<string, PluginMethod>>;
  /// Helpers by name, with the signature each declares.
  helperReturns: Map<string, HelperSignature>;
  /// Enum name -> its members' TSX names mapped to their Dart names.
  enumMembers: Map<string, Map<string, string>>;
  /// local component name -> the Dart file declaring it, relative to this one
  componentImports: Map<string, string>;
  pluginHooks: Map<string, PluginHookInfo>;
  pluginFunctions: Map<string, PluginFunctionInfo>;
  pluginEnums: Map<string, Set<string>>;
  enums: Map<string, Set<string>>;
  forms: ValueForms;
  constantOwners: Map<string, Set<string>>;
  libraries: Map<string, string>;
  exports: Map<string, string[]>;
}

/**
 * The name `if (…) return …;` proves non-null for the statements after it.
 *
 * Only `!x` and `x == null` prove anything: any other condition may be false
 * for reasons that say nothing about null.
 */
const provenNonNull = (condition: ts.Expression): string | null => {
  if (
    ts.isPrefixUnaryExpression(condition) &&
    condition.operator === ts.SyntaxKind.ExclamationToken &&
    ts.isIdentifier(condition.operand)
  ) {
    return condition.operand.text;
  }
  if (
    ts.isBinaryExpression(condition) &&
    ts.isIdentifier(condition.left) &&
    (condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      condition.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) &&
    (condition.right.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(condition.right) &&
        condition.right.text === 'undefined'))
  ) {
    return condition.left.text;
  }
  return null;
};

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
  // What a value of an SDK type can be read for, so a callback parameter —
  // `constraints.maxWidth` — resolves to the Dart member it names.
  const sdkClassFields = new Map<string, Map<string, TypeNode>>();

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
    if (entity.fields.length > 0) {
      sdkClassFields.set(
        entity.name,
        new Map(entity.fields.map((field) => [field.name, field.type])),
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
    constants: new Map(),
    pluginConstructibles: new Map(),
    pluginConstructors: new Map(),
    pluginStatics: new Map(),
    stores: new Map(),
    pluginClassFields: new Map(),
    sdkClassFields,
    prefixedTypes: new Map(),
    models: new Map(),
    userWidgets: new Map(),
    helperReturns: new Map(),
    enumMembers: new Map(),
    componentImports: new Map(),
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

const PROP_SCALARS = new Set<ScalarName>([
  'String',
  'num',
  'int',
  'double',
  'bool',
]);

/**
 * The type node a prop's Dart type stands for.
 *
 * A component's props are declared in TypeScript, so their Dart types are
 * known exactly: a scalar, a list of something, or a model this project
 * declares. Naming the model is what lets `album={{…}}` construct one.
 */
const propTypeNode = (dartType: string): TypeNode => {
  const scalar = [...PROP_SCALARS].find((name) => name === dartType);
  if (scalar !== undefined) {
    return { kind: 'scalar', name: scalar };
  }
  const element = listElementType(dartType);
  if (element !== null) {
    return { kind: 'list', item: propTypeNode(element) };
  }
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(dartType)
    ? { kind: 'named', name: dartType }
    : { kind: 'unknown' };
};

/** Whether the JSX renders a `<TabView>`, which owns a selected index. */
const rendersTabView = (component: ComponentAnalysis): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
      ts.isIdentifier(node.tagName) &&
      node.tagName.text === TAB_VIEW
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(component.returnJsx);
  return found;
};

/**
 * A component needs a State class when it owns something across rebuilds.
 * Known before lowering, because how a prop is read depends on it: a State
 * reaches its props through `widget`.
 */
/**
 * Whether the component needs a State of its own.
 *
 * State, plugins, effects and tabs each need one. So does navigating from a
 * handler: `context.push('/album')` is written against the `context` a State
 * has and a StatelessWidget's methods do not.
 */
const statefulComponent = (component: ComponentAnalysis): boolean =>
  component.states.length > 0 ||
  component.plugins.length > 0 ||
  component.effects.length > 0 ||
  component.asyncBinding !== null ||
  navigatesFromHandler(component) ||
  rendersTabView(component);

const navigatesFromHandler = (component: ComponentAnalysis): boolean => {
  if (component.navigators.length === 0) {
    return false;
  }
  const navigators = new Set(component.navigators);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      navigators.has(node.expression.text)
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  for (const handler of component.handlers) {
    visit(handler.body.body);
  }
  return found;
};

// Dart's where/map are lazy: a helper that says it returns a List has to
// materialise one.
const LAZY_RESULTS = new Set(['filter', 'map', 'where']);

const materialisesList = (
  body: ts.Expression,
  returnDartType: string,
): boolean =>
  listElementType(returnDartType) !== null &&
  ts.isCallExpression(body) &&
  ts.isPropertyAccessExpression(body.expression) &&
  LAZY_RESULTS.has(body.expression.name.text);

const LIST_SUFFIX = /^List<(.+)>$/;

const namedDartTypeOf = (dartType: string): string =>
  LIST_SUFFIX.exec(dartType)?.[1] ?? dartType;

const memberReadOf = (receiver: string, model: IrModel): MemberReadInfo => ({
  className: model.name,
  receiver,
  nullable: false,
  fields: modelFieldTypes(model),
});

const modelClassFields = (
  compile: CompileContext,
): Map<string, Map<string, TypeNode>> =>
  new Map(
    [...compile.models.values()].map(
      (model): [string, Map<string, TypeNode>] => [
        model.name,
        modelFieldTypes(model),
      ],
    ),
  );

/**
 * Lowers a module-level helper to its Dart function. A helper reads only its
 * own parameters, so it needs nothing from a component's context.
 */
/** Data a module declares, as the Dart constant it becomes. */
export const lowerConstant = (
  constant: ConstantBinding,
  compile: CompileContext,
  useDartImport: (uri: string, prefix?: string) => void,
): IrConstant => ({
  name: dartConstantName(constant.name),
  dartType: constant.dartType,
  value: lowerExpression(
    constant.expression,
    propTypeNode(constant.dartType),
    constantContext(
      compile,
      constant.expression.getSourceFile(),
      useDartImport,
    ),
  ),
});

/** Module data reads nothing around it: no state, no props, no plugins. */
const constantContext = (
  compile: CompileContext,
  sourceFile: ts.SourceFile,
  useDartImport: (uri: string, prefix?: string) => void,
): LowerContext => {
  const translate: TranslateContext = {
    sourceFile,
    nullableHandles: new Map(),
    narrowed: new Set(),
    pluginConstructibles: compile.pluginConstructibles,
    pluginConstructors: compile.pluginConstructors,
    stateNames: new Set(),
    handlerNames: new Set(),
    widgetProps: new Set(),
    localDartTypes: new Map(),
    helperReturns: new Map(),
    privateHelpers: new Set(),
    enumMembers: compile.enumMembers,
    privateMembers: false,
    memberReads: new Map(),
    classFields: modelClassFields(compile),
    jsonModels: new Set(compile.models.keys()),
    useDartImport,
  };
  return helperContext(compile, translate);
};

export const lowerHelper = (
  helper: HelperBinding,
  compile: CompileContext,
  useDartImport: (uri: string, prefix?: string) => void,
): IrHelper => {
  const localDartTypes = new Map(
    helper.params.map((param): [string, string] => [
      param.name,
      param.dartType,
    ]),
  );
  const translate: TranslateContext = {
    sourceFile: helper.body.getSourceFile(),
    nullableHandles: new Map(),
    narrowed: new Set(),
    pluginConstructibles: compile.pluginConstructibles,
    pluginConstructors: compile.pluginConstructors,
    stateNames: new Set(),
    handlerNames: new Set(),
    widgetProps: new Set(),
    localDartTypes,
    helperReturns: new Map(),
    privateHelpers: new Set(),
    enumMembers: new Map(),
    privateMembers: false,
    // A helper reads its own parameters, and the models this file declares:
    // decoding or reading one is as ordinary there as in a component.
    memberReads: new Map(
      helper.params.flatMap((param): [string, MemberReadInfo][] => {
        const model = compile.models.get(namedDartTypeOf(param.dartType));
        return model === undefined
          ? []
          : [[param.name, memberReadOf(param.name, model)]];
      }),
    ),
    classFields: modelClassFields(compile),
    jsonModels: new Set(compile.models.keys()),
    useDartImport,
  };
  return {
    name: helper.name,
    typeParams: helper.typeParams,
    params: helper.params,
    returnDartType: helper.returnDartType,
    body: helperBody(helper, compile, translate),
  };
};

/**
 * A helper's body: the one expression it is, or the statements it is written
 * with. A block keeps its locals and its early returns, which is how the same
 * function reads in TypeScript and in Dart.
 */
const helperBody = (
  helper: HelperBinding,
  compile: CompileContext,
  translate: TranslateContext,
): IrHelper['body'] => {
  if (ts.isBlock(helper.body)) {
    return {
      kind: 'block',
      statements: lowerBodyStatements(
        helper.body,
        helperContext(compile, translate),
      ),
    };
  }
  const dart = translateExpression(helper.body, translate);
  return {
    kind: 'expression',
    value: {
      kind: 'dartExpr',
      dart: materialisesList(helper.body, helper.returnDartType)
        ? `${dart}.toList()`
        : dart,
    },
  };
};

/** A helper has no state, no plugins and no widget around it — only itself. */
const helperContext = (
  compile: CompileContext,
  translate: TranslateContext,
): LowerContext => ({
  compile,
  sourceFile: translate.sourceFile,
  stateNames: new Set(),
  handlerNames: new Set(),
  stringStates: new Set(),
  stringLocals: new Set(),
  pluginBindings: new Map(),
  usedPluginImports: new Map(),
  usedDartImports: new Set(),
  storeSetters: new Map(),
  navigators: new Set(),
  tabState: null,
  settersToStates: new Map(),
  localDartTypes: translate.localDartTypes,
  returnsValue: true,
  translate,
});

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
              type: propTypeNode(prop.dartType),
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
  usedPluginImports: Map<string, string | null>;
  // `dart:` imports the lowering discovers, e.g. dart:convert for json().
  usedDartImports: Set<string>;
  storeSetters: Map<string, IrStore>;
  navigators: ReadonlySet<string>;
  // Set while lowering a <TabView>: the component needs a tab-index field
  // even though the author declared no state.
  tabState: { fieldName: string } | null;
  settersToStates: Map<string, string>;
  /** Whether `return <value>;` belongs here: a helper's body, not a handler. */
  returnsValue: boolean;
  /// Dart types of this component's props and state, by name.
  localDartTypes: Map<string, string>;
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
  const plugin = context.pluginBindings.get(identifier.text);
  if (plugin !== undefined) {
    return pluginHandleValue(identifier.text, plugin);
  }
  // Module data took a Dart name of its own, and a read of it uses that name.
  const constant = dartConstantName(identifier.text);
  if (constant !== identifier.text) {
    return { kind: 'dartExpr', dart: constant };
  }
  return {
    kind: 'dartExpr',
    dart: translateExpression(identifier, context.translate),
  };
};

/**
 * The handle a plugin hook hands back, as a value.
 *
 * TSX sees `cam`; Dart sees the field holding it. A handle that is null until
 * the hook has built it is only ever read here inside a `cam && ...` guard —
 * the typings force that guard — so asserting is what the guard already proved.
 */
const pluginHandleValue = (binding: string, info: PluginHookInfo): IrValue => ({
  kind: 'dartExpr',
  dart: `${pluginReceiver(binding, info)}${
    isNullableHandle(info.hook.acquisition) ? '!' : ''
  }`,
});

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
    const model = context.compile.models.get(type.name);
    if (model !== undefined) {
      return lowerModelObject(literal, model, context);
    }
    // `{ enableJavaScript: true }` where a plugin's own class is expected:
    // its constructor is the shape, the same as a widget's or a model's.
    const pluginParams = context.compile.pluginConstructibles.get(type.name);
    if (pluginParams !== undefined) {
      return lowerConstructibleObject(literal, type.name, {
        params: pluginParams,
        context,
      });
    }
  }
  throw tsxErrorAt(
    'TSX0205',
    `an object literal cannot express ${typeLabel(type)} value.`,
    { sourceFile: context.sourceFile, node: literal },
  );
};

/**
 * `{ name: 'Ada' }` where an `Artist` is expected: the model's constructor.
 *
 * The model is generated from the same interface, so its fields are known —
 * a missing one is the interface's own required/optional distinction, which
 * TypeScript has already checked by the time this runs.
 */
const lowerModelObject = (
  literal: ts.ObjectLiteralExpression,
  model: IrModel,
  context: LowerContext,
): IrValue => {
  const byName = new Map(model.fields.map((field) => [field.name, field]));
  const args = literal.properties.map((property): IrArgument => {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      throw tsxErrorAt(
        'TSX0344',
        `\`${model.name}\` is written as \`{ field: value }\`, one field per key.`,
        { sourceFile: context.sourceFile, node: property },
      );
    }
    const field = byName.get(property.name.text);
    if (field === undefined) {
      throw tsxErrorAt(
        'TSX0344',
        `\`${model.name}\` has no field \`${property.name.text}\`.`,
        { sourceFile: context.sourceFile, node: property.name },
      );
    }
    return {
      param: field.name,
      positional: false,
      value: lowerExpression(
        property.initializer,
        field.isModel
          ? { kind: 'named', name: field.dartType }
          : propTypeNode(field.dartType),
        context,
      ),
    };
  });
  return {
    kind: 'construct',
    className: model.name,
    constructorName: '',
    args,
  };
};

const lowerPropertyAccess = (
  expression: ts.PropertyAccessExpression,
  context: LowerContext,
): IrValue => {
  // A read off a plugin handle, a store or a model must translate the same
  // way in a prop as it does in a child — otherwise the prop would emit the
  // TSX name (`info.appName`) instead of the Dart one (`_info?.appName ?? ''`).
  if (readFieldType(expression, context.translate) !== null) {
    return {
      kind: 'dartExpr',
      dart: translateExpression(expression, context.translate),
    };
  }
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
  // Emitting the TSX text verbatim would produce Dart naming something that
  // does not exist there, so an unresolvable read is refused instead.
  throw tsxErrorAt(
    'TSX0305',
    `\`${expression.getText()}\` reads a member the compiler cannot resolve ` +
      'to a Dart one.',
    { sourceFile: context.sourceFile, node: expression },
  );
};

/**
 * A closure's parameters, in scope for its body.
 *
 * Without this a builder can only ignore what it is handed: the compiler
 * would see `constraints` as an unknown identifier and refuse the read.
 */
/** One parameter a callback is handed, and where its members are declared. */
interface ScopedParam {
  name: string;
  type: TypeNode;
  nullable?: boolean;
  fieldsOf: (className: string) => Map<string, TypeNode> | undefined;
}

/**
 * A callback's parameters, readable inside its body.
 *
 * Without this a callback can only ignore what it is handed: the compiler
 * would see `constraints` or `item` as an unknown identifier and refuse the
 * read. Where the members are declared differs — the SDK for a builder, the
 * plugin for a listener — so the caller says which.
 */
const withScopedParams = (
  params: ScopedParam[],
  context: LowerContext,
): LowerContext => {
  const scoped = params.flatMap((param): [string, MemberReadInfo][] => {
    // `_` is what an unnamed or deliberately ignored parameter lowers to.
    if (param.name === '_' || param.type.kind !== 'named') {
      return [];
    }
    const className = param.type.name;
    const fields = param.fieldsOf(className);
    return fields === undefined
      ? []
      : [
          [
            param.name,
            {
              className,
              receiver: param.name,
              // A value handed back through `?.` may be null, and a read of
              // it has to say so or the Dart will not analyze.
              nullable: param.nullable === true,
              fields,
            },
          ],
        ];
  });
  if (scoped.length === 0) {
    return context;
  }
  return {
    ...context,
    translate: {
      ...context.translate,
      memberReads: new Map([...context.translate.memberReads, ...scoped]),
    },
  };
};

const withClosureParams = (
  declared: FunctionParam[],
  names: string[],
  context: LowerContext,
): LowerContext =>
  withScopedParams(
    declared.flatMap((param, index) => {
      const name = names[index];
      return name === undefined
        ? []
        : [
            {
              name,
              type: param.type,
              fieldsOf: (
                className: string,
              ): Map<string, TypeNode> | undefined =>
                context.compile.sdkClassFields.get(className),
            },
          ];
    }),
    context,
  );

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
  // Each named parameter is readable inside the body, for the members its
  // declared SDK type has — `(context, constraints) => …` can read
  // `constraints.maxWidth` because BoxConstraints declares it.
  const scoped = withClosureParams(type.params, params, context);
  // A builder prop — `builder={() => <Text>…</Text>}` — is a callback whose
  // body is a widget rather than a block, so it becomes an expression-bodied
  // Dart closure. Lowering it against the declared return type means a
  // conditional builder reads the same as a conditional child does.
  const { body } = arrow;
  if (!ts.isBlock(body) && type.returnType.kind === 'widget') {
    // Lowered as a child, not as a prop value: a builder body is the same
    // expression a child is, so a conditional one lowers the same way rather
    // than falling through to a path that would emit the TSX verbatim.
    return {
      kind: 'closureValue',
      params,
      value: lowerChildValue(unwrapParenthesized(body), scoped),
    };
  }
  return {
    kind: 'closure',
    params,
    isAsync:
      arrow.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.AsyncKeyword,
      ) ?? false,
    statements: lowerBodyStatements(body, scoped, true),
  };
};

const lowerExpression = (
  parenthesized: ts.Expression,
  paramType: TypeNode,
  context: LowerContext,
): IrValue => {
  const expression = unwrapParenthesized(parenthesized);
  const type = unwrapType(paramType);
  const site: ValueSite = { type, node: expression, context };
  const widened = widenedNumber(expression, type, context);
  if (widened !== null) {
    return widened;
  }
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
    return { kind: 'widget', widget: lowerJsxElement(expression, context) };
  }
  if (ts.isArrowFunction(expression)) {
    return lowerArrowFunction(expression, site);
  }
  // `color={ok ? '#e3f2e6' : '#fde2e1'}` — each branch is a value of the type
  // the prop declares, so each is lowered as one.
  if (ts.isConditionalExpression(expression)) {
    return {
      kind: 'conditional',
      condition: lowerChildCondition(expression.condition, context),
      whenTrue: lowerExpression(expression.whenTrue, paramType, context),
      whenFalse: lowerExpression(expression.whenFalse, paramType, context),
    };
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
  if (ts.isArrayLiteralExpression(expression) && type.kind === 'list') {
    return {
      kind: 'listValue',
      items: expression.elements.map((element) =>
        lowerExpression(element, type.item, context),
      ),
    };
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return lowerPropertyAccess(expression, context);
  }
  if (ts.isIdentifier(expression)) {
    return lowerIdentifier(expression, context);
  }
  // Anything else is translated, never copied: TypeScript source text is
  // not Dart, and emitting it would compile to something else or not at all.
  return {
    kind: 'dartExpr',
    dart: translateExpression(expression, context.translate),
  };
};

/**
 * `.toDouble()` where a whole number meets a parameter that wants a fraction.
 *
 * TypeScript has one number type; Dart has three, and an `int` variable is
 * not assignable to a `double` parameter — only an int *literal* is. So a
 * value the compiler knows to be `int` or `num` is widened at the boundary,
 * which is exactly what a Dart developer writes by hand.
 */
const widenedNumber = (
  expression: ts.Expression,
  type: TypeNode,
  context: LowerContext,
): IrValue | null => {
  if (type.kind !== 'scalar') {
    return null;
  }
  const dart = widenedNumberDart(expression, type.name, context.translate);
  return dart === null ? null : { kind: 'dartExpr', dart };
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
  if (ts.isJsxExpression(initializer)) {
    if (initializer.expression === undefined) {
      throw tsxErrorAt(
        'TSX0345',
        `\`${param.name}={}\` has no value — give it one or leave the prop out.`,
        { sourceFile: context.sourceFile, node: attribute },
      );
    }
    return lowerExpression(initializer.expression, param.type, context);
  }
  // `appBar=<AppBar />` — JSX allows an element as an attribute value with no
  // braces around it, and it means what the braced form means.
  return lowerExpression(initializer, param.type, context);
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
  condition: lowerChildCondition(expression.left, context),
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
  parenthesized: ts.Expression,
  context: LowerContext,
): IrValue => {
  // Wrapping JSX in parentheses is how it is written over several lines, and
  // says nothing about the value inside.
  const expression = unwrapParenthesized(parenthesized);
  if (ts.isJsxElement(expression) || ts.isJsxSelfClosingElement(expression)) {
    return { kind: 'widget', widget: lowerJsxElement(expression, context) };
  }
  if (ts.isConditionalExpression(expression)) {
    return {
      kind: 'conditional',
      condition: lowerChildCondition(expression.condition, context),
      whenTrue: lowerChildValue(expression.whenTrue, context),
      whenFalse: lowerChildValue(expression.whenFalse, context),
    };
  }
  // `{ready && <Preview/>}` in a slot that holds exactly one child: there is
  // no list to leave an entry out of, so the empty case is an empty box.
  const guarded = guardedChildValue(expression, context);
  if (guarded !== null) {
    return guarded;
  }
  return lowerScalarChild(expression, context);
};

/** What a slot holds when its guard is false: the box that takes no space. */
const EMPTY_CHILD: IrValue = {
  kind: 'widget',
  widget: { name: 'SizedBox.shrink', constConstructor: true, args: [] },
};

const guardedChildValue = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue | null => {
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.AmpersandAmpersandToken
  ) {
    return null;
  }
  return {
    kind: 'conditional',
    condition: lowerChildCondition(expression.left, context),
    whenTrue: lowerChildValue(expression.right, context),
    whenFalse: EMPTY_CHILD,
  };
};

/** The `cond` of a conditional child, as Dart sees it. */
const lowerChildCondition = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue => {
  const nullCheck = handleNullCheck(expression, context.translate);
  if (nullCheck !== null) {
    return { kind: 'dartExpr', dart: nullCheck };
  }
  return ts.isIdentifier(expression)
    ? lowerIdentifier(expression, context)
    : {
        kind: 'dartExpr',
        dart: translateExpression(expression, context.translate),
      };
};

const unwrapVoid = (expression: ts.Expression): ts.Expression =>
  ts.isVoidExpression(expression) ? expression.expression : expression;

const unwrapParenthesized = (expression: ts.Expression): ts.Expression =>
  ts.isParenthesizedExpression(expression)
    ? unwrapParenthesized(expression.expression)
    : expression;

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
  requireIterable(callee.expression, context);
  const itemType = iterableElementType(callee.expression, context);
  const bodyContext: LowerContext = {
    ...context,
    stringLocals:
      itemType === 'String'
        ? new Set([...context.stringLocals, itemName])
        : context.stringLocals,
  };
  // Iterating a list of models binds an item whose fields can be read:
  // `jobs.map((job) => <Text>{job.title}</Text>)`.
  const itemModel =
    itemType === null ? undefined : context.compile.models.get(itemType);
  if (itemModel !== undefined) {
    bodyContext.translate = {
      ...context.translate,
      memberReads: new Map(context.translate.memberReads).set(itemName, {
        className: itemModel.name,
        receiver: itemName,
        nullable: false,
        fields: modelFieldTypes(itemModel),
      }),
    };
  }
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

/**
 * What a slot holding exactly one child is given.
 *
 * `Played {plays} times` is three children of one label, and the reader means
 * one line of text — so text and expressions side by side become a single
 * interpolated Text, exactly as they do in a Text's own slot. Two widgets
 * cannot both be the one child, and saying so beats rendering the first and
 * dropping the rest.
 */
const singleChildValue = (
  children: readonly ts.JsxChild[],
  context: LowerContext,
): IrValue | null => {
  const meaningful = children.filter(
    (child) =>
      meaningfulText(child) !== null ||
      ts.isJsxElement(child) ||
      ts.isJsxSelfClosingElement(child) ||
      (ts.isJsxExpression(child) && child.expression !== undefined),
  );
  const [first] = meaningful;
  if (first === undefined) {
    return null;
  }
  if (meaningful.length === 1) {
    return lowerOneChild(first, context);
  }
  const widget = meaningful.find(
    (child) => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
  );
  if (widget !== undefined) {
    throw tsxErrorAt(
      'TSX0350',
      'this slot holds one child: wrap them in a <Column> or a <Row>.',
      { sourceFile: context.sourceFile, node: widget },
    );
  }
  return textValueWidget(textSlotValue(meaningful, context), context);
};

const lowerOneChild = (
  child: ts.JsxChild,
  context: LowerContext,
): IrValue | null => {
  const text = meaningfulText(child);
  if (text !== null) {
    return textWidget(text, context);
  }
  if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) {
    return { kind: 'widget', widget: lowerJsxElement(child, context) };
  }
  return ts.isJsxExpression(child) && child.expression !== undefined
    ? lowerChildValue(child.expression, context)
    : null;
};

const jsxTextValue = (child: ts.JsxText): string =>
  child.text.replace(/\s*\n\s*/g, '');

/** A model's fields as the type nodes member reads are resolved against. */
const modelFieldTypes = (model: IrModel): Map<string, TypeNode> =>
  new Map(
    model.fields.map((field): [string, TypeNode] => [
      field.name,
      propTypeNode(field.dartType),
    ]),
  );

// Methods that narrow or reorder a list without changing what it holds, so
// the element type survives them.
const ELEMENT_PRESERVING = new Set(['filter', 'where', 'reversed', 'toList']);

/**
 * What a list expression yields per item: `jobs` and
 * `jobs.filter(f)` both yield a Job.
 */
/**
 * Refuses `note.title.map(…)` where `title` is a String.
 *
 * Dart iterates lists, not strings, so a `for … in` over one would not
 * compile. The compiler knows the type of a field it declared, so it says
 * which type it found rather than emitting Dart that cannot build.
 */
const requireIterable = (
  expression: ts.Expression,
  context: LowerContext,
): void => {
  if (!ts.isPropertyAccessExpression(expression)) {
    return;
  }
  const field = readFieldType(expression, context.translate);
  if (field === null || field.kind === 'list') {
    return;
  }
  throw tsxErrorAt(
    'TSX0348',
    `\`${expression.getText()}\` is ${typeLabel(field)}, not a list — ` +
      'only a list renders as children.',
    { sourceFile: context.sourceFile, node: expression },
  );
};

const iterableElementType = (
  expression: ts.Expression,
  context: LowerContext,
): string | null => {
  if (ts.isIdentifier(expression)) {
    return listElementType(context.localDartTypes.get(expression.text));
  }
  // `album.tags` is a List<String> and `service.deployments` a list of
  // another model: iterating either binds an element of that type, the same
  // as iterating a list held in a local.
  if (ts.isPropertyAccessExpression(expression)) {
    const field = readFieldType(expression, context.translate);
    return field?.kind === 'list' &&
      (field.item.kind === 'scalar' || field.item.kind === 'named')
      ? field.item.name
      : null;
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ELEMENT_PRESERVING.has(expression.expression.name.text)
  ) {
    return iterableElementType(expression.expression.expression, context);
  }
  return null;
};

/**
 * What a call to a helper yields. A generic helper's return type is resolved
 * from the arguments: `firstOr(names, '-')` over a List<String> yields String.
 */
const helperCallDartType = (
  signature: HelperSignature,
  call: ts.CallExpression,
  context: LowerContext,
): string | null => {
  const { returnDartType } = signature;
  if (!signature.typeParams.includes(returnDartType)) {
    return returnDartType;
  }
  for (const [index, param] of signature.params.entries()) {
    const argument = call.arguments[index];
    if (argument === undefined) continue;
    const argumentType = dartTypeOfArgument(argument, context);
    if (argumentType === null) continue;
    if (param.dartType === returnDartType) return argumentType;
    if (param.dartType === `List<${returnDartType}>`) {
      const element = listElementType(argumentType);
      if (element !== null) return element;
    }
  }
  return null;
};

/** The Dart type of a call argument, when it is plain enough to know. */
const dartTypeOfArgument = (
  argument: ts.Expression,
  context: LowerContext,
): string | null => {
  if (ts.isStringLiteral(argument)) return 'String';
  if (ts.isNumericLiteral(argument)) return 'double';
  if (ts.isIdentifier(argument)) {
    return context.localDartTypes.get(argument.text) ?? null;
  }
  return null;
};

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
      context.stringLocals.has(expression.text) ||
      context.localDartTypes.get(expression.text) === 'String'
    );
  }
  if (ts.isConditionalExpression(expression)) {
    return (
      isStringExpression(expression.whenTrue, context) &&
      isStringExpression(expression.whenFalse, context)
    );
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const field = readFieldType(expression, context.translate);
    return field?.kind === 'scalar' && field.name === 'String';
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression)
  ) {
    return STRING_RETURNING_METHODS.has(expression.expression.name.text);
  }
  // `names[0]` is a String when names is a List<String>, and so is a record
  // field that holds one.
  if (ts.isElementAccessExpression(expression)) {
    if (
      ts.isIdentifier(expression.expression) &&
      ts.isNumericLiteral(expression.argumentExpression)
    ) {
      const field = recordFieldType(
        context.localDartTypes.get(expression.expression.text),
        Number(expression.argumentExpression.text),
      );
      if (field !== null) return field === 'String';
    }
    return iterableElementType(expression.expression, context) === 'String';
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    // The translate context carries both module and component helpers.
    const signature = context.translate.helperReturns.get(
      expression.expression.text,
    );
    return (
      signature !== undefined &&
      helperCallDartType(signature, expression, context) === 'String'
    );
  }
  // `a ?? b` is a String when both sides are.
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
  ) {
    return (
      isStringExpression(expression.left, context) &&
      isStringExpression(expression.right, context)
    );
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

const TAB_VIEW = 'TabView';
const TAB = 'TabItem';
const TAB_INDEX_FIELD = 'tabIndex';

const TAB_SHAPE_ERROR = `<${TAB_VIEW}> takes <${TAB} label="…" icon="…"> children, one per tab.`;

interface LoweredTab {
  label: string;
  icon: string;
  child: IrValue;
}

const stringAttribute = (
  element: ts.JsxOpeningElement,
  name: string,
): string | null => {
  for (const attribute of element.attributes.properties) {
    if (
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText() === name &&
      attribute.initializer !== undefined &&
      ts.isStringLiteral(attribute.initializer)
    ) {
      return attribute.initializer.text;
    }
  }
  return null;
};

const numberAttribute = (
  element: ts.JsxOpeningElement,
  name: string,
): string | null => {
  const expression = expressionAttribute(element, name);
  return expression !== null && ts.isNumericLiteral(expression)
    ? expression.text
    : null;
};

const expressionAttribute = (
  element: ts.JsxOpeningElement,
  name: string,
): ts.Expression | null => {
  for (const attribute of element.attributes.properties) {
    if (
      ts.isJsxAttribute(attribute) &&
      attribute.name.getText() === name &&
      attribute.initializer !== undefined &&
      ts.isJsxExpression(attribute.initializer) &&
      attribute.initializer.expression !== undefined
    ) {
      return attribute.initializer.expression;
    }
  }
  return null;
};

// Each <TabItem label icon> contributes one destination and one page. The icon is
// checked against the SDK's own Icons constants, so a typo fails here rather
// than in Dart.
const lowerTab = (child: ts.JsxChild, context: LowerContext): LoweredTab => {
  if (
    !ts.isJsxElement(child) ||
    child.openingElement.tagName.getText() !== TAB
  ) {
    throw tsxErrorAt('TSX0331', TAB_SHAPE_ERROR, {
      sourceFile: context.sourceFile,
      node: child,
    });
  }
  const label = stringAttribute(child.openingElement, 'label');
  const icon = stringAttribute(child.openingElement, 'icon');
  const page = singleChildValue(child.children, context);
  if (label === null || icon === null || page === null) {
    throw tsxErrorAt('TSX0331', TAB_SHAPE_ERROR, {
      sourceFile: context.sourceFile,
      node: child.openingElement,
    });
  }
  if (context.compile.constantOwners.get('Icons')?.has(icon) !== true) {
    throw tsxErrorAt(
      'TSX0332',
      `\`${icon}\` is not an icon in the SDK's Icons.`,
      { sourceFile: context.sourceFile, node: child.openingElement },
    );
  }
  return { label, icon, child: page };
};

const tabItem = (tab: LoweredTab): IrChild => ({
  kind: 'value',
  value: {
    kind: 'construct',
    className: 'BottomNavigationBarItem',
    constructorName: '',
    args: [
      {
        param: 'icon',
        positional: false,
        value: {
          kind: 'construct',
          className: 'Icon',
          constructorName: '',
          args: [
            {
              param: 'icon',
              positional: true,
              value: { kind: 'constantRef', owner: 'Icons', member: tab.icon },
            },
          ],
        },
      },
      {
        param: 'label',
        positional: false,
        value: { kind: 'string', value: tab.label },
      },
    ],
  },
});

// <TabView> is the vision's bottom-tab shell: an IndexedStack keeps every page
// alive while the bar switches between them, driven by a synthesized index.
const lowerTabView = (
  element: ts.JsxElement,
  context: LowerContext,
): IrWidget => {
  const tabs = element.children
    .filter((child) => !ts.isJsxText(child) || meaningfulText(child) !== null)
    .map((child) => lowerTab(child, context));
  if (tabs.length === 0) {
    throw tsxErrorAt('TSX0331', TAB_SHAPE_ERROR, {
      sourceFile: context.sourceFile,
      node: element,
    });
  }
  context.tabState = { fieldName: TAB_INDEX_FIELD };
  const indexRef: IrValue = { kind: 'stateRef', name: TAB_INDEX_FIELD };
  return {
    name: 'Scaffold',
    constConstructor: false,
    args: [
      {
        param: 'body',
        positional: false,
        value: {
          kind: 'widget',
          widget: {
            name: 'IndexedStack',
            constConstructor: false,
            args: [
              { param: 'index', positional: false, value: indexRef },
              {
                param: 'children',
                positional: false,
                value: {
                  kind: 'widgetList',
                  items: tabs.map((tab) => ({
                    kind: 'value' as const,
                    value: tab.child,
                  })),
                },
              },
            ],
          },
        },
      },
      {
        param: 'bottomNavigationBar',
        positional: false,
        value: {
          kind: 'widget',
          widget: {
            name: 'BottomNavigationBar',
            constConstructor: false,
            args: [
              { param: 'currentIndex', positional: false, value: indexRef },
              {
                param: 'onTap',
                positional: false,
                value: {
                  kind: 'dartExpr',
                  dart: `(index) => setState(() => _${TAB_INDEX_FIELD} = index)`,
                },
              },
              {
                param: 'items',
                positional: false,
                value: { kind: 'widgetList', items: tabs.map(tabItem) },
              },
            ],
          },
        },
      },
    ],
  };
};

const ANIMATED = 'Animated';

const ANIMATED_SHAPE_ERROR =
  `<${ANIMATED}> takes type="fade" with visible={…}, or type="scale" with ` +
  'scale={…}, plus duration={ms} and one child.';

// The driving value is required: an implicit animation with nothing changing
// would compile to a widget that never animates.
const ANIMATED_KINDS: Record<string, { widget: string; param: string }> = {
  fade: { widget: 'AnimatedOpacity', param: 'opacity' },
  scale: { widget: 'AnimatedScale', param: 'scale' },
};

const animatedError = (node: ts.Node, context: LowerContext): never => {
  throw tsxErrorAt('TSX0333', ANIMATED_SHAPE_ERROR, {
    sourceFile: context.sourceFile,
    node,
  });
};

const lowerAnimated = (
  element: ts.JsxElement,
  context: LowerContext,
): IrWidget => {
  const opening = element.openingElement;
  const kind = ANIMATED_KINDS[stringAttribute(opening, 'type') ?? ''];
  if (kind === undefined) {
    return animatedError(opening, context);
  }
  const duration = numberAttribute(opening, 'duration');
  const child = singleChildValue(element.children, context);
  if (duration === null || child === null) {
    return animatedError(opening, context);
  }
  const driver = expressionAttribute(
    opening,
    kind.widget === 'AnimatedOpacity' ? 'visible' : 'scale',
  );
  if (driver === null) {
    return animatedError(opening, context);
  }
  // A boolean drives opacity through a ternary; a number is already the value.
  const value: IrValue =
    kind.widget === 'AnimatedOpacity'
      ? {
          kind: 'dartExpr',
          dart: `${translateExpression(driver, context.translate)} ? 1 : 0`,
        }
      : {
          kind: 'dartExpr',
          dart: translateExpression(driver, context.translate),
        };
  return {
    name: kind.widget,
    constConstructor: false,
    args: [
      { param: kind.param, positional: false, value },
      {
        param: 'duration',
        positional: false,
        value: {
          kind: 'construct',
          className: 'Duration',
          constructorName: '',
          args: [
            {
              param: 'milliseconds',
              positional: false,
              value: { kind: 'number', value: duration },
            },
          ],
        },
      },
      { param: 'child', positional: false, value: child },
    ],
  };
};

const lowerJsxElement = (
  element: ts.JsxElement | ts.JsxSelfClosingElement,
  context: LowerContext,
): IrWidget => {
  const opening = ts.isJsxElement(element) ? element.openingElement : element;
  const widgetName = opening.tagName.getText();
  if (widgetName === ANIMATED) {
    if (!ts.isJsxElement(element)) {
      return animatedError(opening, context);
    }
    return lowerAnimated(element, context);
  }
  if (widgetName === TAB_VIEW) {
    if (!ts.isJsxElement(element)) {
      throw tsxErrorAt('TSX0331', TAB_SHAPE_ERROR, {
        sourceFile: context.sourceFile,
        node: opening,
      });
    }
    return lowerTabView(element, context);
  }
  // A component this file declares or imports shadows a Flutter widget of the
  // same name, the way a local binding shadows a global one.
  const info =
    context.compile.userWidgets.get(widgetName) ??
    context.compile.widgets.get(widgetName);
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

// go_router's BuildContext extension: `nav.push('/x')` is `context.push('/x')`
// in the build method's own context, so it needs no navigator plumbing.
const NAVIGATION_METHODS = new Set(['push', 'pop', 'replace', 'go']);

// `nav.present(<X/>)` opens the widget: showDialog for a dialog,
// showModalBottomSheet for a sheet. Both take the build context and a builder.
const PRESENTATION_METHODS: Record<string, string> = {
  present: 'showDialog',
  presentSheet: 'showModalBottomSheet',
};

const presentationValue = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue | null => {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isPropertyAccessExpression(expression.expression) ||
    !ts.isIdentifier(expression.expression.expression) ||
    !context.navigators.has(expression.expression.expression.text)
  ) {
    return null;
  }
  const opener = PRESENTATION_METHODS[expression.expression.name.text];
  if (opener === undefined) {
    return null;
  }
  const [modal] = expression.arguments;
  if (
    modal === undefined ||
    (!ts.isJsxElement(modal) && !ts.isJsxSelfClosingElement(modal))
  ) {
    throw tsxErrorAt(
      'TSX0330',
      `\`${expression.expression.name.text}\` takes the widget to open: ` +
        '`nav.present(<ConfirmDialog />)`.',
      { sourceFile: context.sourceFile, node: expression },
    );
  }
  return {
    kind: 'construct',
    className: opener,
    constructorName: '',
    args: [
      {
        param: 'context',
        positional: false,
        value: { kind: 'dartExpr', dart: 'context' },
      },
      {
        param: 'builder',
        positional: false,
        value: {
          kind: 'closureValue',
          params: ['context'],
          value: { kind: 'widget', widget: lowerJsxElement(modal, context) },
        },
      },
    ],
  };
};

const navigationLine = (
  expression: ts.Expression,
  context: LowerContext,
): string | null => {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isPropertyAccessExpression(expression.expression) ||
    !ts.isIdentifier(expression.expression.expression) ||
    !context.navigators.has(expression.expression.expression.text)
  ) {
    return null;
  }
  const method = expression.expression.name.text;
  if (!NAVIGATION_METHODS.has(method)) {
    throw tsxErrorAt(
      'TSX0329',
      `navigation has no \`${method}\`: use push, replace, go or pop.`,
      { sourceFile: context.sourceFile, node: expression.expression.name },
    );
  }
  // The rewrite only works with go_router's extension in scope.
  context.usedPluginImports.set(GO_ROUTER_IMPORT, null);
  const args = expression.arguments.map((argument) =>
    translateExpression(argument, context.translate),
  );
  return statementCall(`context.${method}`, args);
};

// `setState({ count: … })` on a store setter becomes one update() call, which
// patches the given fields and notifies listeners once.
const storeUpdateLine = (
  expression: ts.Expression,
  context: LowerContext,
): string | null => {
  if (
    !ts.isCallExpression(expression) ||
    !ts.isIdentifier(expression.expression)
  ) {
    return null;
  }
  const store = context.storeSetters.get(expression.expression.text);
  if (store === undefined) {
    return null;
  }
  const [patch] = expression.arguments;
  if (patch === undefined || !ts.isObjectLiteralExpression(patch)) {
    throw tsxErrorAt(
      'TSX0325',
      'a store setter takes an object of the fields to change: ' +
        '`setState({ count: 1 })`.',
      { sourceFile: context.sourceFile, node: expression },
    );
  }
  const known = new Set(store.fields.map((field) => field.name));
  const args = objectEntries(patch, 'TSX0206', context).map((entry) => {
    if (!known.has(entry.key)) {
      throw tsxErrorAt('TSX0326', `the store has no field \`${entry.key}\`.`, {
        sourceFile: context.sourceFile,
        node: entry.node,
      });
    }
    // The field's declared type is what the value has to be: a `num` read off
    // a model lands in an `int` field as `.toInt()`, which is the conversion
    // Dart requires and a developer would write.
    const declared =
      store.fields.find((field) => field.name === entry.key)?.dartType ?? '';
    const value =
      widenedNumberDart(entry.initializer, declared, context.translate) ??
      translateExpression(entry.initializer, context.translate);
    return `${entry.key}: ${value}`;
  });
  return statementCall(`${store.instanceName}.update`, args);
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
      'a state setter takes the new value (`setCount(count + 1)`).',
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

/**
 * Consecutive state updates belong in one `setState`, however many statements
 * they were lowered from.
 */
const mergeSetState = (statements: IrStatement[]): IrStatement[] =>
  statements.reduce<IrStatement[]>((merged, statement) => {
    const previous = merged[merged.length - 1];
    if (statement.kind === 'setState' && previous?.kind === 'setState') {
      previous.assignments.push(...statement.assignments);
      return merged;
    }
    return [...merged, statement];
  }, []);

/**
 * A `switch` whose clauses each end in `break`, which is what Dart requires:
 * a clause that falls through to the next is a different construct there, so
 * only stacked empty clauses (`case 1: case 2:`) share a body.
 */
const lowerSwitch = (
  statement: ts.SwitchStatement,
  context: LowerContext,
  allowPluginCalls: boolean,
): IrStatement => {
  const cases: { values: string[]; body: IrStatement[] }[] = [];
  let fallback: IrStatement[] | null = null;
  let pending: string[] = [];

  for (const clause of statement.caseBlock.clauses) {
    const body = mergeSetState(
      clause.statements
        .filter((each) => !ts.isBreakStatement(each))
        .flatMap((each) => lowerStatement(each, context, allowPluginCalls)),
    );
    if (ts.isDefaultClause(clause)) {
      fallback = body;
      continue;
    }
    pending.push(translateExpression(clause.expression, context.translate));
    // An empty clause stacks onto the next one, sharing its body.
    if (clause.statements.length === 0) continue;
    cases.push({ values: pending, body });
    pending = [];
  }
  if (pending.length > 0) {
    throw tsxErrorAt('TSX0337', 'the last `case` of a `switch` needs a body.', {
      sourceFile: context.sourceFile,
      node: statement,
    });
  }
  return {
    kind: 'switch',
    value: translateExpression(statement.expression, context.translate),
    cases,
    fallback,
  };
};

/** The statements of `{ … }`, or the single statement of `if (c) doIt();`. */
const branchStatements = (
  statement: ts.Statement,
  context: LowerContext,
  allowPluginCalls: boolean,
): IrStatement[] =>
  ts.isBlock(statement)
    ? lowerBodyStatements(statement, context, allowPluginCalls)
    : mergeSetState(lowerStatement(statement, context, allowPluginCalls));

// A statement form the body walker understands on its own, rather than as an
// expression; null when this is not one of them.
const lowerControlFlow = (
  statement: ts.Statement,
  context: LowerContext,
  allowPluginCalls: boolean,
): IrStatement[] | null => {
  if (ts.isTryStatement(statement)) {
    const clause = statement.catchClause;
    if (clause === undefined) {
      throw tsxErrorAt(
        'TSX0337',
        'a `try` needs a `catch`: `finally` on its own is not compiled.',
        { sourceFile: context.sourceFile, node: statement },
      );
    }
    const declaration = clause.variableDeclaration;
    // `} catch { … }` names nothing, which is Dart's `catch (_)`.
    const error =
      declaration !== undefined && ts.isIdentifier(declaration.name)
        ? declaration.name.text
        : '_';
    return [
      {
        kind: 'try',
        body: lowerBodyStatements(
          statement.tryBlock,
          context,
          allowPluginCalls,
        ),
        error,
        onError: lowerBodyStatements(clause.block, context, allowPluginCalls),
      },
    ];
  }
  if (ts.isForOfStatement(statement)) {
    const binding = statement.initializer;
    const declared = ts.isVariableDeclarationList(binding)
      ? binding.declarations[0]?.name
      : undefined;
    if (declared === undefined || !ts.isIdentifier(declared)) {
      throw tsxErrorAt(
        'TSX0337',
        'a `for … of` binds one name: `for (const item of items)`.',
        { sourceFile: context.sourceFile, node: statement },
      );
    }
    return [
      {
        kind: 'forOf',
        itemName: declared.text,
        iterable: translateExpression(statement.expression, context.translate),
        body: branchStatements(statement.statement, context, allowPluginCalls),
      },
    ];
  }
  // `if (!cam) return;` — leaving early is how a guard is written, and it
  // maps onto Dart's own return. A helper returns a value; a handler has
  // nothing to return, so saying otherwise there is an error.
  if (ts.isReturnStatement(statement)) {
    if (statement.expression === undefined) {
      return [{ kind: 'dart', line: 'return;' }];
    }
    if (!context.returnsValue) {
      throw tsxErrorAt(
        'TSX0342',
        'a handler returns nothing: use `return;` to leave it early.',
        { sourceFile: context.sourceFile, node: statement },
      );
    }
    const returned = translateExpression(
      statement.expression,
      context.translate,
    );
    return [{ kind: 'dart', line: `return ${returned};` }];
  }
  if (ts.isWhileStatement(statement)) {
    return [
      {
        kind: 'while',
        condition: translateCondition(statement.expression, context.translate),
        body: branchStatements(statement.statement, context, allowPluginCalls),
      },
    ];
  }
  if (ts.isSwitchStatement(statement)) {
    return [lowerSwitch(statement, context, allowPluginCalls)];
  }
  if (!ts.isIfStatement(statement)) return null;
  return [
    {
      kind: 'if',
      condition: translateCondition(statement.expression, context.translate),
      then: branchStatements(
        statement.thenStatement,
        context,
        allowPluginCalls,
      ),
      otherwise:
        statement.elseStatement === undefined
          ? []
          : branchStatements(
              statement.elseStatement,
              context,
              allowPluginCalls,
            ),
    },
  ];
};

/** What an `await` hands over: the value a Future carries. */
const awaitedType = (type: TypeNode): TypeNode =>
  type.kind === 'future' ? type.item : type;

/**
 * `const file = await cam.takePicture();` — a value a body names and then
 * uses. Null when the statement is not a declaration, which is every other
 * statement form.
 */
const lowerLocalDeclaration = (
  statement: ts.Statement,
  context: LowerContext,
  allowPluginCalls: boolean,
): { statement: IrStatement; context: LowerContext } | null => {
  if (!ts.isVariableStatement(statement)) {
    return null;
  }
  const [declaration] = statement.declarationList.declarations;
  if (
    declaration === undefined ||
    statement.declarationList.declarations.length !== 1 ||
    !ts.isIdentifier(declaration.name) ||
    declaration.initializer === undefined
  ) {
    throw tsxErrorAt(
      'TSX0305',
      'declare one value at a time: `const file = await cam.takePicture();`.',
      { sourceFile: context.sourceFile, node: statement },
    );
  }

  const name = declaration.name.text;
  const { initializer } = declaration;
  const awaited = ts.isAwaitExpression(initializer);
  const call = awaited ? initializer.expression : initializer;
  const resolved =
    allowPluginCalls && ts.isCallExpression(call)
      ? resolvePluginCall(call, context, declaration)
      : null;

  if (resolved === null) {
    const line = `final ${name} = ${translateExpression(initializer, context.translate)};`;
    // `const type = new MediaType(…)` — a value the developer made is as
    // readable as one the plugin handed over.
    const constructed =
      ts.isNewExpression(call) && ts.isIdentifier(call.expression)
        ? call.expression.text
        : null;
    if (
      constructed === null ||
      !context.compile.pluginClassFields.has(constructed)
    ) {
      return { statement: { kind: 'dart', line }, context };
    }
    return {
      statement: { kind: 'dart', line },
      context: withScopedParams(
        [
          {
            name,
            type: { kind: 'named', name: constructed },
            nullable: false,
            fieldsOf: (className: string): Map<string, TypeNode> | undefined =>
              context.compile.pluginClassFields.get(className),
          },
        ],
        context,
      ),
    };
  }

  const value = statementCall(
    `${awaited ? 'await ' : ''}${resolved.invocation}`,
    resolved.args,
  ).replace(/;$/, '');
  const returned = awaited
    ? awaitedType(resolved.returnType)
    : resolved.returnType;
  return {
    statement: { kind: 'dart', line: `final ${name} = ${value};` },
    // What the call handed back is readable, the same as anything else the
    // plugin hands over.
    context: withScopedParams(
      [
        {
          name,
          type: returned,
          nullable: resolved.nullableResult,
          fieldsOf: (className: string): Map<string, TypeNode> | undefined =>
            context.compile.pluginClassFields.get(className),
        },
      ],
      context,
    ),
  };
};

const lowerStatement = (
  statement: ts.Statement,
  context: LowerContext,
  allowPluginCalls: boolean,
): IrStatement[] => {
  const controlFlow = lowerControlFlow(statement, context, allowPluginCalls);
  if (controlFlow !== null) return controlFlow;
  return lowerExpressionStatement(
    {
      // `void doIt();` is how TypeScript says a promise is deliberately not
      // awaited — which is the only thing a synchronous `dispose` can do with
      // one. Dart has no such marker, so the call is emitted on its own.
      expression: ts.isExpressionStatement(statement)
        ? unwrapVoid(statement.expression)
        : undefined,
      errorNode: statement,
    },
    context,
    allowPluginCalls,
  );
};

/**
 * The scope after a statement, given what a guard that leaves has proven.
 *
 * `if (!cam) return;` excludes null for the rest of the body, so the reads
 * below it are made on a value Dart no longer treats as null either.
 */
const narrowedBy = (
  statement: ts.Statement,
  context: LowerContext,
): LowerContext => {
  if (!ts.isIfStatement(statement) || statement.elseStatement !== undefined) {
    return context;
  }
  const leaves = ts.isBlock(statement.thenStatement)
    ? statement.thenStatement.statements.every(ts.isReturnStatement)
    : ts.isReturnStatement(statement.thenStatement);
  const proven = provenNonNull(statement.expression);
  if (!leaves || proven === null) {
    return context;
  }
  return {
    ...context,
    translate: {
      ...context.translate,
      narrowed: new Set([...context.translate.narrowed, proven]),
    },
  };
};

const lowerBodyStatements = (
  body: ts.ConciseBody,
  context: LowerContext,
  allowPluginCalls = false,
): IrStatement[] => {
  if (ts.isBlock(body)) {
    // A local is in scope for the statements after it, so the context each
    // statement is lowered in grows as the body goes on.
    const lowered: IrStatement[] = [];
    let scope = context;
    for (const statement of body.statements) {
      const local = lowerLocalDeclaration(statement, scope, allowPluginCalls);
      if (local !== null) {
        lowered.push(local.statement);
        scope = local.context;
        continue;
      }
      lowered.push(...lowerStatement(statement, scope, allowPluginCalls));
      scope = narrowedBy(statement, scope);
    }
    return mergeSetState(lowered);
  }
  return lowerExpressionStatement(
    { expression: body, errorNode: body },
    context,
    allowPluginCalls,
  );
};

interface StatementSource {
  expression: ts.Expression | undefined;
  errorNode: ts.Node;
}

const lowerExpressionStatement = (
  { expression, errorNode }: StatementSource,
  context: LowerContext,
  allowPluginCalls: boolean,
): IrStatement[] => {
  const pluginLine =
    allowPluginCalls && expression !== undefined
      ? pluginCallLine(expression, context, errorNode)
      : null;
  if (pluginLine !== null) {
    return [{ kind: 'dart', line: pluginLine }];
  }
  const presentation =
    expression === undefined ? null : presentationValue(expression, context);
  if (presentation !== null) {
    return [{ kind: 'expr', value: presentation }];
  }
  const navLine =
    expression === undefined ? null : navigationLine(expression, context);
  if (navLine !== null) {
    return [{ kind: 'dart', line: navLine }];
  }
  const storeLine =
    expression === undefined ? null : storeUpdateLine(expression, context);
  if (storeLine !== null) {
    return [{ kind: 'dart', line: storeLine }];
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
      'only a state setter call compiles here — this statement does not ' +
        'update state.',
      { sourceFile: context.sourceFile, node: errorNode },
    );
  }
  return [
    {
      kind: 'setState',
      assignments: [setterAssignment(expression, stateName, context)],
    },
  ];
};

interface PluginCall {
  invocation: string;
  args: string[];
  returnType: TypeNode;
  /** True when the call goes through `?.`, so its result may be null. */
  nullableResult: boolean;
}

// Resolves a plugin call to its Dart invocation and return type; null when the
// expression is not a plugin call at all.
const resolvePluginCall = (
  call: ts.CallExpression,
  context: LowerContext,
  errorNode: ts.Node,
): PluginCall | null => {
  if (ts.isIdentifier(call.expression)) {
    const fnInfo = context.compile.pluginFunctions.get(call.expression.text);
    if (fnInfo === undefined) {
      return null;
    }
    context.usedPluginImports.set(fnInfo.dartImport, fnInfo.importPrefix);
    const invocation =
      fnInfo.importPrefix === null
        ? fnInfo.fn.name
        : `${fnInfo.importPrefix}.${fnInfo.fn.name}`;
    return {
      invocation,
      args: pluginCallArguments(call, fnInfo.fn, context),
      returnType: fnInfo.fn.returnType,
      // A top-level function is called directly: there is no handle to be null.
      nullableResult: false,
    };
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
    // `MultipartFile.fromBytes(…)` — a static of a plugin's class, which is
    // the only way some of its values are made.
    return staticPluginCall(call.expression, call, context);
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
  // A guard above the call has already excluded null, and the source wrote a
  // plain `.` — so the call is made on the value, not around it.
  const accessor =
    context.translate.narrowed.has(binding) &&
    call.expression.questionDotToken === undefined
      ? '!.'
      : pluginAccessor(info);
  return {
    invocation: `${pluginReceiver(binding, info)}${accessor}${methodName}`,
    args: pluginCallArguments(call, method, context),
    returnType: method.returnType,
    nullableResult: accessor === '?.',
  };
};

/** A call to a static a plugin class declares, or null when it is not one. */
const staticPluginCall = (
  callee: ts.PropertyAccessExpression,
  call: ts.CallExpression,
  context: LowerContext,
): PluginCall | null => {
  const className = ts.isIdentifier(callee.expression)
    ? callee.expression.text
    : '';
  const method = context.compile.pluginStatics
    .get(className)
    ?.get(callee.name.text);
  if (method === undefined) {
    return null;
  }
  return {
    invocation: `${className}.${method.name}`,
    args: pluginCallArguments(call, method, context),
    returnType: method.returnType,
    // A static is called on the class itself: there is no handle to be null.
    nullableResult: false,
  };
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
  const resolved = resolvePluginCall(call, context, errorNode);
  if (resolved === null) {
    return null;
  }
  const prefix = awaited ? 'await ' : '';
  return statementCall(`${prefix}${resolved.invocation}`, resolved.args);
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
  /** The characters already on the line before this value, e.g. `mode: `. */
  site: { context: LowerContext; prefixWidth?: number },
): string => {
  const { context, prefixWidth = 0 } = site;
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
  // `{ enableJavaScript: true }` where the plugin declares one of its own
  // classes: the literal builds that class, the way it builds a model.
  if (
    paramType?.kind === 'named' &&
    ts.isObjectLiteralExpression(argument) &&
    context.compile.pluginConstructibles.has(paramType.name)
  ) {
    // The value sits one level inside the call it is an argument of, which
    // is where the formatter wraps it from.
    return printExpr(
      irValueToDart(lowerObjectLiteral(argument, paramType, context), {
        privateMembers: true,
      }),
      { indent: 2, used: 2 + prefixWidth, trailing: 1 },
    );
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
        pluginArgumentValue(argument, positionalParams[positionalIndex], {
          context,
        }),
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
      const prefix = `${entry.key}: `;
      rendered.push(
        `${prefix}${pluginArgumentValue(entry.initializer, param, {
          context,
          prefixWidth: prefix.length,
        })}`,
      );
    }
  }
  return rendered;
};

const pascalCase = (name: string): string =>
  `${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`;

export const lowerRouter = (router: RouterBinding): IrRouter => ({
  name: router.name,
  routes: router.routes,
});

/**
 * A store is shared by definition — that is what `createStore` is for — so it
 * is emitted public. A private one could not be read from the file next door,
 * which is where a store usually belongs.
 */
export const lowerStore = (store: StoreBinding): IrStore => ({
  className: pascalCase(store.name),
  instanceName: store.name,
  fields: store.fields.map((field) => ({
    name: field.name,
    dartType: field.dartType,
    initializer: field.initialText,
  })),
});

// A type from a prefixed plugin has to be written with that prefix wherever
// it appears in generated Dart, not only at the call site.
const dartTypeIn = (type: TypeNode, compile: CompileContext): string | null => {
  const bare = bareDartTypeOf(type);
  if (bare === null) {
    return null;
  }
  let prefixed = bare;
  for (const [name, replacement] of compile.prefixedTypes) {
    prefixed = prefixed.replaceAll(name, replacement);
  }
  return prefixed;
};

interface AsyncSource {
  invocation: string;
  // null for a property read: there is no argument list to render.
  args: string[] | null;
  type: TypeNode;
}

// The source of a future or stream: a plugin method call, or a plugin
// property read (`connectivity.onConnectivityChanged`).
const resolveAsyncSource = (
  load: ts.Expression,
  context: LowerContext,
): AsyncSource | null => {
  if (ts.isCallExpression(load)) {
    const resolved = resolvePluginCall(load, context, load);
    return resolved === null
      ? null
      : {
          invocation: resolved.invocation,
          args: resolved.args,
          type: resolved.returnType,
        };
  }
  if (
    !ts.isPropertyAccessExpression(load) ||
    !ts.isIdentifier(load.expression)
  ) {
    return null;
  }
  const binding = load.expression.text;
  const info = context.pluginBindings.get(binding);
  const field = info?.fields.get(load.name.text);
  if (info === undefined || field === undefined) {
    return null;
  }
  const accessor = info.hook.acquisition.kind === 'constField' ? '.' : '?.';
  return {
    invocation: `_${binding}${accessor}${load.name.text}`,
    args: null,
    type: field,
  };
};

export const lowerModel = (
  model: ModelBinding,
  known: ReadonlySet<string>,
): IrModel => ({
  name: model.name,
  fields: model.fields.map((field) => ({
    name: field.name,
    dartType: field.dartType,
    required: field.required,
    isModel: known.has(field.dartType),
  })),
});

// `const album = json<Album>(res.body)` decodes through the generated class.
const jsonLocalBind = (
  local: LocalBinding,
  context: LowerContext,
): IrBuilderBind | null => {
  const call = ts.isAsExpression(local.expression)
    ? local.expression.expression
    : local.expression;
  if (
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== 'json'
  ) {
    return null;
  }
  const [body] = call.arguments;
  // `json` returns `unknown`, so the cast is the only thing that can name the
  // model — which is also how TypeScript code normally types a parsed body.
  const modelName = local.declaredType;
  const model =
    modelName === null ? undefined : context.compile.models.get(modelName);
  if (model === undefined || body === undefined) {
    throw tsxErrorAt(
      'TSX0335',
      '`json` needs an interface from this file and a body: ' +
        '`json(res.body) as Album`.',
      { sourceFile: context.sourceFile, node: call },
    );
  }
  context.usedDartImports.add('dart:convert');
  context.translate.memberReads.set(local.name, {
    className: model.name,
    receiver: local.name,
    nullable: false,
    fields: new Map(
      model.fields.map((field) => [
        field.name,
        field.isModel
          ? { kind: 'named', name: field.dartType }
          : dartFieldType(field.dartType),
      ]),
    ),
  });
  const decoded = `jsonDecode(${translateExpression(body, context.translate)}) as Map<String, dynamic>`;
  return {
    name: local.name,
    value: {
      kind: 'construct',
      className: `${model.name}.fromJson`,
      constructorName: '',
      args: [
        {
          param: 'json',
          positional: true,
          value: { kind: 'dartExpr', dart: decoded },
        },
      ],
    },
  };
};

// A component-body local: a json decode, or any expression the translator
// can render.
const localBind = (
  local: LocalBinding,
  context: LowerContext,
): IrBuilderBind => {
  const decoded = jsonLocalBind(local, context);
  if (decoded !== null) {
    return decoded;
  }
  return {
    name: local.name,
    value: {
      kind: 'dartExpr',
      dart: translateExpression(local.expression, context.translate),
    },
  };
};

interface LoweredAsync {
  field: IrField;
  initStatement: IrStatement;
  body: IrWidget;
}

// `await useAsync(load, { loading, error })` becomes a late future assigned in
// initState plus a FutureBuilder whose three states each render something.
const lowerAsyncBinding = (
  binding: AsyncBinding,
  parts: { returnJsx: ts.Expression; locals: LocalBinding[] },
  context: LowerContext,
): LoweredAsync => {
  const { returnJsx, locals } = parts;
  const { load } = binding;
  const isStream = binding.hook === 'useStream';
  const sourceKind = isStream ? 'stream' : 'future';
  const source = resolveAsyncSource(load, context);
  const dataType =
    source?.type.kind === sourceKind
      ? dartTypeIn(source.type.item, context.compile)
      : null;
  if (source === null || dataType === null) {
    const wrapper = isStream ? 'Stream' : 'Future';
    throw tsxErrorAt(
      'TSX0321',
      `\`${binding.hook}\` needs a ${wrapper} whose type the compiler ` +
        'knows: read it off a plugin, e.g. ' +
        `\`${binding.hook}(() => storage.readAll(), …)\`.`,
      { sourceFile: context.sourceFile, node: load },
    );
  }
  // Both binds are locals with known Dart types: the error is always a
  // String, and the data's type comes from the future. Registering them keeps
  // `{err}` rendering as `err`, not a redundant `'$err'`.
  const branchContext: LowerContext = {
    ...context,
    stringLocals: new Set([
      ...context.stringLocals,
      binding.errorParam,
      ...(dataType === 'String' ? [binding.name] : []),
    ]),
  };
  // The resolved value is a plain local, so its readable fields come from the
  // plugin class it is an instance of.
  const item = source.type.kind === sourceKind ? source.type.item : null;
  const itemClass = item?.kind === 'named' ? item.name : null;
  const itemFields =
    itemClass === null
      ? undefined
      : context.compile.pluginClassFields.get(itemClass);
  if (itemFields !== undefined && itemClass !== null) {
    branchContext.translate.memberReads.set(binding.name, {
      className: itemClass,
      receiver: binding.name,
      nullable: false,
      fields: itemFields,
    });
  }
  // Locals declared after the await belong inside the builder, where the
  // resolved value is in scope.
  const localBinds: IrBuilderBind[] = locals.map((local) =>
    localBind(local, branchContext),
  );
  const fieldName = `_${binding.name}${isStream ? 'Stream' : 'Future'}`;
  return {
    field: {
      name: fieldName,
      dartType: `${isStream ? 'Stream' : 'Future'}<${dataType}>`,
      mutable: false,
      initializer: null,
      lateFinal: true,
    },
    initStatement: {
      kind: 'dart',
      line:
        source.args === null
          ? `${fieldName} = ${source.invocation};`
          : statementCall(`${fieldName} = ${source.invocation}`, source.args),
    },
    body: {
      name: `${isStream ? 'Stream' : 'Future'}Builder<${dataType}>`,
      constConstructor: false,
      args: [
        {
          param: isStream ? 'stream' : 'future',
          positional: false,
          value: { kind: 'dartExpr', dart: fieldName },
        },
        {
          param: 'builder',
          positional: false,
          value: {
            kind: 'builder',
            params: ['context', 'snapshot'],
            guards: [
              {
                condition: 'snapshot.hasError',
                bind: {
                  name: binding.errorParam,
                  value: {
                    kind: 'dartExpr',
                    dart: "'${snapshot.error}'",
                  },
                },
                value: lowerFallbackJsx(binding.errorJsx, branchContext),
              },
              {
                condition: '!snapshot.hasData',
                bind: null,
                value: lowerFallbackJsx(binding.loadingJsx, branchContext),
              },
            ],
            binds: [
              {
                name: binding.name,
                value: { kind: 'dartExpr', dart: 'snapshot.data!' },
              },
              ...localBinds,
            ],
            value: lowerFallbackJsx(returnJsx, branchContext),
          },
        },
      ],
    },
  };
};

const lowerFallbackJsx = (
  expression: ts.Expression,
  context: LowerContext,
): IrValue => {
  if (
    !ts.isJsxElement(expression) &&
    !ts.isJsxSelfClosingElement(expression) &&
    !ts.isJsxFragment(expression)
  ) {
    throw tsxErrorAt('TSX0204', 'a component must return a widget element.', {
      sourceFile: context.sourceFile,
      node: expression,
    });
  }
  return {
    kind: 'widget',
    widget: ts.isJsxFragment(expression)
      ? columnOf(lowerListChildren(expression.children, context), context)
      : lowerJsxElement(expression, context),
  };
};

// showDialog and friends look up the Navigator, which is illegal while
// initState runs — a mount effect that presents must wait one frame.
const needsPostFrame = (statements: IrStatement[]): boolean =>
  statements.some(
    (statement) =>
      statement.kind === 'expr' &&
      statement.value.kind === 'construct' &&
      statement.value.className in PRESENTATION_OPENERS,
  );

const PRESENTATION_OPENERS: Record<string, true> = {
  showDialog: true,
  showModalBottomSheet: true,
};

/** A mount effect's own statements, and the cleanup it returns. */
interface LoweredEffects {
  init: IrStatement[];
  dispose: IrStatement[];
}

const lowerEffects = (
  effects: ts.CallExpression[],
  context: LowerContext,
): LoweredEffects => {
  const init: IrStatement[] = [];
  const dispose: IrStatement[] = [];

  for (const effect of effects) {
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
    // `return () => { … }` is the unmount half of the effect: its statements
    // become the widget's `dispose`, which is where Flutter frees what a
    // mount set up.
    let mountBody: ts.ConciseBody = body.body;
    if (ts.isBlock(body.body)) {
      const cleanup = body.body.statements.find((statement) =>
        ts.isReturnStatement(statement),
      );
      if (cleanup !== undefined && ts.isReturnStatement(cleanup)) {
        const returned = cleanup.expression;
        if (returned === undefined || !ts.isArrowFunction(returned)) {
          throw tsxErrorAt(
            'TSX0307',
            'an effect returns either nothing or its cleanup function ' +
              '(`return () => { … }`).',
            { sourceFile: context.sourceFile, node: cleanup },
          );
        }
        dispose.push(...lowerBodyStatements(returned.body, context, true));
        mountBody = ts.factory.createBlock(
          body.body.statements.filter((statement) => statement !== cleanup),
          true,
        );
      }
    }
    // A mount effect calls plugins as freely as its cleanup does: setting a
    // tooltip or starting a listener is exactly what one is for.
    const statements = lowerBodyStatements(mountBody, context, true);
    init.push(
      ...(needsPostFrame(statements)
        ? [{ kind: 'postFrame' as const, statements }]
        : statements),
    );
  }

  return { init, dispose };
};

const capitalize = (name: string): string =>
  name === '' ? name : `${name[0]?.toUpperCase() ?? ''}${name.slice(1)}`;

const lowerFirst = (name: string): string =>
  name === '' ? name : `${name[0]?.toLowerCase() ?? ''}${name.slice(1)}`;

const supplierLocalName = (functionName: string, paramType: string): string =>
  functionName.startsWith('available')
    ? lowerFirst(functionName.slice('available'.length))
    : `${lowerFirst(paramType)}s`;

interface LoweredPlugin {
  /** Null when the package holds the instance and this file just uses it. */
  field: IrField | null;
  setup: { name: string; lines: string[] } | null;
  initCall: IrStatement | null;
  disposeLine: string | null;
  pluginImport: string;
}

/**
 * The listener callbacks a component wrote, lowered into the overrides that
 * answer them. A component that writes none is never registered, so a widget
 * carries a mixin only because it asked for the events.
 */
const lowerListenerOverrides = (
  binding: PluginBinding,
  info: PluginHookInfo,
  context: LowerContext,
): IrOverride[] => {
  const { listener } = info.hook;
  const [argument] = binding.call.arguments;
  if (
    listener === null ||
    argument === undefined ||
    !ts.isObjectLiteralExpression(argument)
  ) {
    return [];
  }
  const eventsByName = new Map(
    listener.events.map((event) => [event.name, event]),
  );
  const overrides: IrOverride[] = [];
  for (const entry of objectEntries(argument, 'TSX0206', context)) {
    const event = eventsByName.get(entry.key);
    if (event === undefined) continue;
    if (!ts.isArrowFunction(entry.initializer)) {
      throw tsxErrorAt(
        'TSX0313',
        `${entry.key} is an event: give it a function, ` +
          `\`${entry.key}: () => { … }\`.`,
        { sourceFile: context.sourceFile, node: entry.node },
      );
    }
    const callback = entry.initializer;
    const scoped = withScopedParams(
      event.params.map((param, index) => ({
        name: callback.parameters[index]?.name.getText() ?? param.name,
        type: param.type,
        fieldsOf: (className: string): Map<string, TypeNode> | undefined =>
          context.compile.pluginClassFields.get(className),
      })),
      context,
    );
    overrides.push({
      name: event.name,
      params: event.params.map((param, index) => ({
        // The developer names the value; the plugin says what it is.
        name: callback.parameters[index]?.name.getText() ?? param.name,
        dartType: param.dartType,
      })),
      statements: lowerBodyStatements(callback.body, scoped, true),
    });
  }
  return overrides;
};

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
    // A function is never an option: it is a callback, lowered separately
    // into the override that answers it.
    if (ts.isArrowFunction(entry.initializer)) continue;
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

/** What a plugin call is written against: a field, or the package's own instance. */
const pluginReceiver = (binding: string, info: PluginHookInfo): string =>
  info.hook.acquisition.kind === 'topLevelInstance'
    ? info.hook.acquisition.instanceName
    : `_${binding}`;

/** A nullable handle needs `?.`; one that always exists does not. */
const pluginAccessor = (info: PluginHookInfo): string =>
  isNullableHandle(info.hook.acquisition) ? '?.' : '.';

/** `trayManager.addListener(this)` while the widget is mounted, and off again. */
const listenerLines = (
  binding: string,
  info: PluginHookInfo,
): { register: string; unregister: string } | null => {
  const { listener } = info.hook;
  if (listener === null) return null;
  const receiver = pluginReceiver(binding, info);
  const accessor = pluginAccessor(info);
  return {
    register: `${receiver}${accessor}${listener.addMethod}(this);`,
    unregister: `${receiver}${accessor}${listener.removeMethod}(this);`,
  };
};

const lowerPluginBinding = (
  binding: PluginBinding,
  info: PluginHookInfo,
  context: LowerContext,
): LoweredPlugin => {
  const fieldName = `_${binding.binding}`;
  const { acquisition } = info.hook;

  // The package already declares the instance; a field aliasing it would be
  // noise, so calls go straight to `trayManager`.
  if (acquisition.kind === 'topLevelInstance') {
    return {
      field: null,
      setup: null,
      initCall: null,
      disposeLine: null,
      pluginImport: info.hook.dartImport,
    };
  }

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
  const localDartTypes = new Map<string, string>([
    // Module data is in scope for every component in the file, and for the
    // ones that import it.
    ...compile.constants,
    ...component.props.map((prop): [string, string] => [
      prop.name,
      prop.dartType,
    ]),
    ...component.states.map((state): [string, string] => [
      state.name,
      state.dartType,
    ]),
  ]);
  const memberReads = new Map<string, MemberReadInfo>();
  // A prop or state holding a model has readable fields: `p.x` where p is a
  // Point. A State reaches its props through `widget`.
  const readsThroughWidget = statefulComponent(component);
  for (const prop of component.props) {
    const model = compile.models.get(prop.dartType);
    if (model !== undefined) {
      memberReads.set(prop.name, {
        className: model.name,
        receiver: readsThroughWidget ? `widget.${prop.name}` : prop.name,
        nullable: !prop.required,
        fields: modelFieldTypes(model),
      });
    }
  }
  const stateNames = new Set(component.states.map((state) => state.name));
  const handlerNames = new Set(
    component.handlers.map((handler) => handler.name),
  );
  const nullableHandles = new Map<string, string>();
  // Grows as the component's guards are lowered, so every read after a guard
  // sees what that guard proved.
  const narrowed = new Set<string>();
  const context: LowerContext = {
    compile,
    navigators: new Set(component.navigators),
    tabState: null,
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
    usedPluginImports: new Map(),
    usedDartImports: new Set(),
    storeSetters: new Map(),
    localDartTypes,
    returnsValue: false,
    settersToStates: new Map(
      component.states.map((state) => [state.setterName, state.name]),
    ),
    translate: {
      sourceFile: component.sourceFile,
      stateNames,
      handlerNames,
      widgetProps: statefulComponent(component)
        ? new Set(component.props.map((prop) => prop.name))
        : new Set<string>(),
      localDartTypes,
      helperReturns: new Map([
        ...compile.helperReturns,
        ...component.helpers.map((helper): [string, HelperSignature] => [
          helper.name,
          {
            typeParams: helper.typeParams,
            params: helper.params,
            returnDartType: helper.returnDartType,
          },
        ]),
      ]),
      privateHelpers: new Set(component.helpers.map((helper) => helper.name)),
      enumMembers: compile.enumMembers,
      privateMembers: true,
      memberReads,
      jsonModels: new Set(compile.models.keys()),
      nullableHandles,
      narrowed,
      pluginConstructibles: compile.pluginConstructibles,
      pluginConstructors: compile.pluginConstructors,
      useDartImport: (uri: string, prefix?: string): void => {
        if (prefix === undefined) {
          context.usedDartImports.add(uri);
          return;
        }
        context.usedPluginImports.set(uri, prefix);
      },
      classFields: new Map<string, Map<string, TypeNode>>([
        ...compile.sdkClassFields,
        ...compile.pluginClassFields,
        ...[...compile.models.values()].map(
          (model): [string, Map<string, TypeNode>] => [
            model.name,
            new Map<string, TypeNode>(
              model.fields.map((field) => [
                field.name,
                field.isModel
                  ? { kind: 'named', name: field.dartType }
                  : dartFieldType(field.dartType),
              ]),
            ),
          ],
        ),
      ]),
    },
  };

  const store = storeFor(component, compile, context);

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
    if (isNullableHandle(info.hook.acquisition)) {
      nullableHandles.set(
        binding.binding,
        pluginReceiver(binding.binding, info),
      );
    }
    memberReads.set(binding.binding, {
      className: info.hook.className,
      receiver: pluginReceiver(binding.binding, info),
      nullable: pluginAccessor(info) === '?.',
      fields: info.fields,
    });
    return {
      binding,
      info,
      overrides: lowerListenerOverrides(binding, info, context),
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

  // A helper declared inside the component reads its props and state, so it
  // is lowered in the component's own context and emitted as a private method.
  // A component answers a plugin's events only where it wrote the callbacks;
  // the mixin and the registration follow from that, not the other way round.
  const listening = loweredPlugins.filter(
    ({ overrides: answered }) => answered.length > 0,
  );
  const overrides = listening.flatMap(({ overrides: answered }) => answered);
  const mixins = [
    ...new Set(
      listening.flatMap(({ info }) =>
        info.hook.listener === null ? [] : [info.hook.listener.className],
      ),
    ),
  ];
  const listenerRegistrations = listening.flatMap(({ binding, info }) => {
    const lines = listenerLines(binding.binding, info);
    return lines === null ? [] : [lines];
  });

  const effects = lowerEffects(component.effects, context);

  // A helper declared inside the component reads its state and props, so it
  // is lowered in the component's own context with its parameters added.
  const componentHelpers: IrHelper[] = component.helpers.map((helper) => {
    const scoped: LowerContext = {
      ...context,
      translate: {
        ...context.translate,
        localDartTypes: new Map([
          ...context.localDartTypes,
          ...helper.params.map((param): [string, string] => [
            param.name,
            param.dartType,
          ]),
        ]),
      },
      returnsValue: true,
    };
    return {
      name: helper.name,
      typeParams: helper.typeParams,
      params: helper.params,
      returnDartType: helper.returnDartType,
      body: ts.isBlock(helper.body)
        ? {
            kind: 'block' as const,
            statements: lowerBodyStatements(helper.body, scoped),
          }
        : {
            kind: 'expression' as const,
            value: {
              kind: 'dartExpr' as const,
              dart: translateExpression(helper.body, scoped.translate),
            },
          },
    };
  });
  const methods: IrMethod[] = component.handlers.map((handler) => ({
    name: handler.name,
    isAsync: handler.isAsync,
    params: handler.params,
    // What the callback is handed is in scope for its body, so a read of it
    // resolves the way a prop's or a local's does.
    statements: lowerBodyStatements(
      handler.body.body,
      {
        ...context,
        localDartTypes: new Map([
          ...context.localDartTypes,
          ...handler.params.map((param): [string, string] => [
            param.name,
            param.dartType,
          ]),
        ]),
        stringLocals: new Set([
          ...context.stringLocals,
          ...handler.params
            .filter((param) => param.dartType === 'String')
            .map((param) => param.name),
        ]),
      },
      true,
    ),
  }));

  const lowered =
    component.asyncBinding === null
      ? null
      : lowerAsyncBinding(
          component.asyncBinding,
          { returnJsx: root, locals: component.locals },
          context,
        );

  // Locals register their reads, so they must be bound before the body that
  // reads them is lowered.
  const buildLocals =
    component.asyncBinding === null
      ? component.locals.map((local) => localBind(local, context))
      : [];

  // Guards are lowered before the body so a read they narrow is already
  // registered when the tree below them is lowered.
  const guards = component.guards.map((guard) => {
    const lowered = {
      condition: translateCondition(guard.condition, context.translate),
      value: lowerChildValue(guard.jsx, context),
    };
    // The guard returns, so everything below it has this name non-null.
    const proven = provenNonNull(guard.condition);
    if (proven !== null) {
      narrowed.add(proven);
    }
    return lowered;
  });

  // The body must be lowered before the literal below reads
  // usedPluginImports or context.tabState: an import discovered while
  // lowering a handler, or the index a <TabView> needs, would otherwise be
  // recorded too late.
  const body = storeWrapped(
    lowered?.body ??
      (ts.isJsxFragment(root)
        ? columnOf(lowerListChildren(root.children, context), context)
        : lowerJsxElement(root, context)),
    store,
  );

  // A <TabView> owns its selected index, so the component is stateful even
  // when the author declared no state of their own.
  const tabField: IrField[] =
    context.tabState === null
      ? []
      : [
          {
            name: `_${context.tabState.fieldName}`,
            dartType: 'int',
            mutable: true,
            initializer: '0',
          },
        ];
  const isStateful = statefulComponent(component) || tabField.length > 0;

  return {
    name: component.name,
    kind: isStateful ? 'stateful' : 'stateless',
    props: component.props,
    states: component.states,
    plugins: component.plugins,
    handlers: component.handlers,
    effects: component.effects,
    fields: [
      ...loweredPlugins.flatMap(({ lowered: plugin }) =>
        plugin.field === null ? [] : [plugin.field],
      ),
      ...(lowered === null ? [] : [lowered.field]),
      ...tabField,
      ...component.states.map((state) => ({
        name: translateIdentifier(state.name, context.translate),
        dartType: state.dartType,
        mutable: state.mutable,
        initializer: translateExpression(state.initializer, context.translate),
      })),
    ],
    methods,
    helpers: componentHelpers,
    setupMethods: loweredPlugins.flatMap(({ lowered }) =>
      lowered.setup === null ? [] : [lowered.setup],
    ),
    mixins,
    overrides,
    initStatements: [
      ...loweredPlugins.flatMap(({ lowered: plugin }) =>
        plugin.initCall === null ? [] : [plugin.initCall],
      ),
      ...listenerRegistrations.map((lines): IrStatement => ({
        kind: 'dart',
        line: lines.register,
      })),
      ...(lowered === null ? [] : [lowered.initStatement]),
      ...effects.init,
    ],
    disposeLines: [
      ...listenerRegistrations.map((lines) => lines.unregister),
      ...loweredPlugins.flatMap(({ lowered }) =>
        lowered.disposeLine === null ? [] : [lowered.disposeLine],
      ),
    ],
    disposeStatements: effects.dispose,
    buildLocals,
    guards,
    pluginImports: [
      ...new Map<string, string | null>([
        ...loweredPlugins.map(
          ({ lowered }) => [lowered.pluginImport, null] as const,
        ),
        ...[...context.usedDartImports].map((uri) => [uri, null] as const),
        ...context.usedPluginImports,
      ]),
    ].map(([uri, prefix]) => ({ uri, prefix })),
    body,
  };
};

// Registers the store's reads and its setter so the body and the handlers can
// be lowered against them; returns the store this component listens to.
const storeFor = (
  component: ComponentAnalysis,
  compile: CompileContext,
  context: LowerContext,
): IrStore | null => {
  const use = component.storeUse;
  if (use === null) {
    return null;
  }
  const store = compile.stores.get(use.storeName);
  if (store === undefined) {
    throw tsxErrorAt(
      'TSX0322',
      `\`${use.storeName}\` is not a store created in this file with ` +
        '`createStore({ … })`.',
      { sourceFile: context.sourceFile, node: component.nameNode },
    );
  }
  context.translate.memberReads.set(use.stateName, {
    className: store.className,
    receiver: store.instanceName,
    nullable: false,
    fields: new Map(
      store.fields.map((field) => [field.name, dartFieldType(field.dartType)]),
    ),
  });
  context.storeSetters.set(use.setterName, store);
  return store;
};

// The store's Dart type is already resolved; reads only need to know whether
// a field is a String, so the node carries just enough to answer that.
/** A model field's Dart type, as the type node reads of it resolve against. */
const dartFieldType = (dartType: string): TypeNode => propTypeNode(dartType);

// A store-driven component stays stateless: the ChangeNotifier drives the
// rebuild through ListenableBuilder.
const storeWrapped = (body: IrWidget, store: IrStore | null): IrWidget =>
  store === null
    ? body
    : {
        name: 'ListenableBuilder',
        constConstructor: false,
        args: [
          {
            param: 'listenable',
            positional: false,
            value: { kind: 'dartExpr', dart: store.instanceName },
          },
          {
            param: 'builder',
            positional: false,
            value: {
              kind: 'builder',
              params: ['context', 'child'],
              guards: [],
              binds: [],
              value: { kind: 'widget', widget: body },
            },
          },
        ],
      };
