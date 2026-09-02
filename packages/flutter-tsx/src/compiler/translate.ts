import ts from 'typescript';

import type { ParamModel, TypeNode } from '../api/model';
import { dartConstantName, listElementType } from './dart-names';
import { escapeDartString } from './dart-print';
import { tsxErrorAt } from './diagnostics';

/// A receiver whose properties translate to Dart member reads: a plugin
/// handle (nullable until acquired) or a store instance (always present).
export interface MemberReadInfo {
  className: string;
  receiver: string;
  nullable: boolean;
  fields: Map<string, TypeNode>;
}

export interface HelperSignature {
  typeParams: string[];
  params: { name: string; dartType: string }[];
  returnDartType: string;
}

export interface TranslateContext {
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  /// Props reached through `widget.` because the reader is a State class.
  widgetProps: Set<string>;
  /// Dart types of this component's props and state, by name.
  localDartTypes: Map<string, string>;
  /// Helpers by name, with the signature each declares.
  helperReturns: Map<string, HelperSignature>;
  /// Helpers declared inside the component, emitted as private methods.
  privateHelpers: Set<string>;
  /// Enum name -> its members' TSX names mapped to their Dart names.
  enumMembers: Map<string, Map<string, string>>;
  handlerNames: Set<string>;
  privateMembers: boolean;
  memberReads: Map<string, MemberReadInfo>;
  // Fields by class name, so a read can continue through a field whose type
  // is another known class: `album.author.name`.
  classFields: Map<string, Map<string, TypeNode>>;
  /** Models declared in this file, so `json(body) as Album` can be decoded. */
  jsonModels: ReadonlySet<string>;
  /**
   * Records a Dart import the translation needs, e.g. `dart:convert`, or
   * `dart:math` under the prefix its members are reached through.
   */
  useDartImport: (uri: string, prefix?: string) => void;
  /**
   * Plugin handles that are null until their hook has built them, mapped to
   * the Dart expression holding each. TSX tests them for truth (`if (!cam)`,
   * `{cam && …}`); Dart has no truthiness, so they become null checks.
   */
  nullableHandles: ReadonlyMap<string, string>;
  /**
   * Plugin classes a `new` expression may build, with the parameters each
   * constructor declares. Dart has no `new`, so it is dropped — but only for
   * a class the plugin really exports, never for an arbitrary name.
   */
  pluginConstructibles: ReadonlyMap<string, readonly ParamModel[]>;
  /** Controllers the component owns, which are fields of its State. */
  controllerNames: ReadonlySet<string>;
  /** Every plugin class `new` can call, and the parameters it declares. */
  pluginConstructors: ReadonlyMap<string, readonly ParamModel[]>;
  /**
   * A plugin call that hands back a value there and then, printed where it
   * is used — `prefs?.getString('name') ?? 'guest'`. Null for anything else,
   * including a call that returns a Future: that one is awaited, and an
   * await belongs to a statement rather than to the value it produces.
   */
  pluginValueCall: (call: ts.CallExpression) => string | null;
  /**
   * Names an early return has proven non-null at this point.
   *
   * `if (!info) return …;` excludes null for everything after it. Dart cannot
   * promote a field, so the same read becomes `_info!.appName`. This is read
   * from the guards themselves rather than from the type checker, which
   * cannot help here: the program is built with `noResolve`, so an imported
   * type is `any` and would claim every value is non-null.
   */
  narrowed: ReadonlySet<string>;
}

const BINARY_OPERATORS = new Map<ts.SyntaxKind, string>([
  [ts.SyntaxKind.PlusToken, '+'],
  [ts.SyntaxKind.MinusToken, '-'],
  [ts.SyntaxKind.AsteriskToken, '*'],
  [ts.SyntaxKind.SlashToken, '/'],
  [ts.SyntaxKind.PercentToken, '%'],
  [ts.SyntaxKind.EqualsEqualsEqualsToken, '=='],
  [ts.SyntaxKind.ExclamationEqualsEqualsToken, '!='],
  [ts.SyntaxKind.LessThanToken, '<'],
  [ts.SyntaxKind.GreaterThanToken, '>'],
  [ts.SyntaxKind.LessThanEqualsToken, '<='],
  [ts.SyntaxKind.GreaterThanEqualsToken, '>='],
  [ts.SyntaxKind.AmpersandAmpersandToken, '&&'],
  [ts.SyntaxKind.BarBarToken, '||'],
  [ts.SyntaxKind.QuestionQuestionToken, '??'],
]);

/** `cam` / `!cam` as Dart, when `cam` is a handle that may not be ready. */
export const handleNullCheck = (
  expression: ts.Expression,
  context: TranslateContext,
): string | null => {
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const receiver = handleReceiver(expression.operand, context);
    return receiver === null ? null : `${receiver} == null`;
  }
  const receiver = handleReceiver(expression, context);
  return receiver === null ? null : `${receiver} != null`;
};

const handleReceiver = (
  expression: ts.Expression,
  context: TranslateContext,
): string | null =>
  ts.isIdentifier(expression)
    ? (context.nullableHandles.get(expression.text) ?? null)
    : null;

/** A boolean expression, with plugin handles read as null checks. */
export const translateCondition = (
  expression: ts.Expression,
  context: TranslateContext,
): string =>
  handleNullCheck(expression, context) ??
  translateExpression(expression, context);

const DART_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

// Members that mean the same thing on TS and Dart values.
const SHARED_MEMBERS = new Set(['length']);

// Methods whose Dart counterpart takes the same arguments in the same order
// and means the same thing. Each one is verified against the Dart SDK; a
// method whose semantics differ (slice, find, sort, padStart) is deliberately
// absent, so it raises a diagnostic rather than compiling to something subtly
// different.
const DART_METHODS = new Map([
  ['toUpperCase', 'toUpperCase'],
  ['toLowerCase', 'toLowerCase'],
  ['trim', 'trim'],
  ['startsWith', 'startsWith'],
  ['endsWith', 'endsWith'],
  ['split', 'split'],
  ['indexOf', 'indexOf'],
  ['replaceAll', 'replaceAll'],
  ['toString', 'toString'],
  ['join', 'join'],
  ['includes', 'contains'],
  ['some', 'any'],
  ['every', 'every'],
  ['toFixed', 'toStringAsFixed'],
  ['filter', 'where'],
  ['substring', 'substring'],
  // Dart's `map` is lazy, so a helper that returns a List materialises it —
  // see `materialisesList`. Everything downstream of it takes an Iterable.
  ['map', 'map'],
]);

/**
 * Methods with no faithful Dart counterpart, and what to write instead.
 *
 * `slice` clamps out-of-range indices and counts from the end for negatives;
 * Dart's `substring` does neither, so renaming it would compile to something
 * that behaves differently. The diagnostic names the way that does work.
 */
const METHOD_ALTERNATIVES = new Map([
  ['slice', '`substring(start, end)`, with indices inside the value'],
  ['find', '`filter(…)[0]`, or a `for … of` loop over the list'],
  ['sort', 'a list built in the order you want it'],
  ['padStart', 'the branches spelled out, or `toStringAsFixed`'],
  ['padEnd', 'the branches spelled out, or `toStringAsFixed`'],
  ['at', 'an index, as `values[0]`'],
  ['flatMap', '`map(…)` and then a spread'],
]);

// `reduce` and `fold` mean the same thing with the arguments the other way
// round: JS takes (step, initial), Dart takes (initial, step).
const REDUCE = 'reduce';

/** Of those, the ones that produce a String whatever the receiver is. */
export const STRING_RETURNING_METHODS = new Set([
  'substring',
  'toUpperCase',
  'toLowerCase',
  'trim',
  'replaceAll',
  'join',
  'toString',
  'toFixed',
]);

// Dart zero values, so a read through a nullable plugin handle is never null
// at the use site — no context-sensitive coercion needed downstream.
const ZERO_VALUES = new Map([
  ['String', "''"],
  ['int', '0'],
  ['double', '0'],
  ['num', '0'],
  ['bool', 'false'],
]);

const zeroValueOf = (type: TypeNode): string | null =>
  type.kind === 'scalar' ? (ZERO_VALUES.get(type.name) ?? null) : null;

const typeLabel = (type: TypeNode): string =>
  'name' in type ? type.name : type.kind;

/// The fields readable off an expression: a registered receiver, or a field
/// of one whose type is another known class. Recursive, so a chain of any
/// depth resolves through the same rule.
const fieldsOf = (
  expression: ts.Expression,
  context: TranslateContext,
): Map<string, TypeNode> | undefined => {
  if (ts.isParenthesizedExpression(expression)) {
    return fieldsOf(expression.expression, context);
  }
  // `(json(body) as Track).title` — the cast names the type being read.
  if (
    ts.isAsExpression(expression) &&
    ts.isTypeReferenceNode(expression.type)
  ) {
    return context.classFields.get(expression.type.typeName.getText());
  }
  if (ts.isIdentifier(expression)) {
    return context.memberReads.get(expression.text)?.fields;
  }
  // `lookup().title` — a helper's result is readable for whatever its declared
  // return type is, the same as any other value of that type.
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const helper = context.helperReturns.get(expression.expression.text);
    return helper === undefined
      ? undefined
      : context.classFields.get(helper.returnDartType);
  }
  if (!ts.isPropertyAccessExpression(expression)) {
    return undefined;
  }
  const field = fieldsOf(expression.expression, context)?.get(
    expression.name.text,
  );
  return field?.kind === 'named'
    ? context.classFields.get(field.name)
    : undefined;
};

/// The declared type a read lands on, following the chain from its receiver;
/// null when the chain is not a known read.
export const readFieldType = (
  expression: ts.PropertyAccessExpression,
  context: TranslateContext,
): TypeNode | null =>
  fieldsOf(expression.expression, context)?.get(expression.name.text) ?? null;

/**
 * The Dart numeric type of an expression, when the compiler knows it.
 *
 * TypeScript has one number type and Dart has three: `int` and `num` are not
 * assignable to `double`, so the compiler has to know which it is holding.
 */
export const numericDartTypeOf = (
  expression: ts.Expression,
  context: TranslateContext,
): 'int' | 'double' | 'num' | null => {
  if (ts.isIdentifier(expression)) {
    return numericName(context.localDartTypes.get(expression.text));
  }
  if (ts.isPropertyAccessExpression(expression)) {
    const field = readFieldType(expression, context);
    return field?.kind === 'scalar' ? numericName(field.name) : null;
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const signature = context.helperReturns.get(expression.expression.text);
    return signature === undefined
      ? null
      : numericName(signature.returnDartType);
  }
  return null;
};

const numericName = (
  dartType: string | undefined | null,
): 'int' | 'double' | 'num' | null =>
  dartType === 'int' || dartType === 'double' || dartType === 'num'
    ? dartType
    : null;

/** How Dart converts to each numeric type it will not accept implicitly. */
const NUMERIC_CONVERSIONS: Record<string, string> = {
  double: 'toDouble',
  int: 'toInt',
};

/**
 * The conversion where one numeric type meets a declaration of another.
 *
 * Dart accepts an int *literal* where a double is wanted and nothing else: an
 * `int` or `num` value needs `.toDouble()`, and a `num` needs `.toInt()` to
 * land in an `int`. Both are what a Dart developer writes by hand, and both
 * are only applied when the compiler knows the value's own type.
 */
export const widenedNumberDart = (
  expression: ts.Expression,
  targetDartType: string,
  context: TranslateContext,
): string | null => {
  const conversion = NUMERIC_CONVERSIONS[targetDartType];
  const actual = numericDartTypeOf(expression, context);
  if (
    conversion === undefined ||
    actual === null ||
    actual === targetDartType
  ) {
    return null;
  }
  return `${translateExpression(expression, context)}.${conversion}()`;
};

/**
 * Dart hands `map` one value, so a second parameter has nothing to be.
 *
 * `items.map((item, index) => …)` is ordinary JavaScript and would compile to
 * a callback Dart never calls that way, so it is reported here.
 */
const requireSingleParameterCallback = (
  call: ts.CallExpression,
  context: TranslateContext,
): void => {
  const [callback] = call.arguments;
  if (
    callback !== undefined &&
    (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback)) &&
    callback.parameters.length > 1
  ) {
    throw tsxErrorAt(
      'TSX0343',
      '`map` hands the callback one value in Dart: drop the index, or ' +
        'build the list with a `for … of` loop.',
      {
        sourceFile: context.sourceFile,
        node: callback.parameters[1] as ts.Node,
      },
    );
  }
};

// Methods that hand their callback one element of the receiver, so the
// callback's parameter is a value of the element's type.
const ELEMENT_CALLBACKS = new Set(['map', 'filter', 'some', 'every']);

// Methods that yield the same element type they were given, so an element
// type survives a chain of them.
const ELEMENT_PRESERVING_METHODS = new Set(['filter', 'where']);

/** The element type of a list expression, when the compiler knows it. */
const elementTypeOf = (
  expression: ts.Expression,
  context: TranslateContext,
): string | null => {
  if (ts.isIdentifier(expression)) {
    return listElementType(context.localDartTypes.get(expression.text));
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ELEMENT_PRESERVING_METHODS.has(expression.expression.name.text)
  ) {
    return elementTypeOf(expression.expression.expression, context);
  }
  return null;
};

/**
 * The context a callback's body is translated in.
 *
 * `albums.filter((album) => album.title.includes(query))` binds `album` to an
 * element of the list, so its fields read the same way a prop's do.
 */
const withCallbackItem = (
  context: TranslateContext,
  callback: ts.Expression,
  elementType: string | null,
): TranslateContext => {
  if (
    elementType === null ||
    !ts.isArrowFunction(callback) ||
    callback.parameters.length !== 1
  ) {
    return context;
  }
  const [parameter] = callback.parameters;
  const name = parameter?.name.getText() ?? '';
  const fields = context.classFields.get(elementType);
  return {
    ...context,
    localDartTypes: new Map([...context.localDartTypes, [name, elementType]]),
    memberReads:
      fields === undefined
        ? context.memberReads
        : new Map([
            ...context.memberReads,
            [
              name,
              {
                className: elementType,
                receiver: name,
                nullable: false,
                fields,
              },
            ],
          ]),
  };
};

/**
 * What `new C(…)` hands the constructor.
 *
 * A constructor of named parameters is written with one object — the shape
 * the typings declare — and Dart takes them as named arguments; a positional
 * one is written and translated as it stands.
 */
const constructorArguments = (
  expression: ts.NewExpression,
  params: readonly ParamModel[],
  context: TranslateContext,
): string[] => {
  const args = [...(expression.arguments ?? [])];
  const [only] = args;
  if (
    args.length === 1 &&
    only !== undefined &&
    ts.isObjectLiteralExpression(only) &&
    params.length > 0 &&
    params.every((param) => param.named)
  ) {
    return only.properties.map((property) =>
      !ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)
        ? notYetCompiled(property, context)
        : `${property.name.text}: ${translateExpression(property.initializer, context)}`,
    );
  }
  return args.map((argument) => translateExpression(argument, context));
};

/**
 * The named value and the known class an `instanceof` is testing, or null
 * when it is testing something the compiler cannot resolve — an unknown
 * class, or a value it has no name for and so cannot promote.
 */
export const instanceOfTest = (
  expression: ts.Expression,
  context: TranslateContext,
): {
  name: string;
  className: string;
  fields: Map<string, TypeNode>;
} | null => {
  if (
    !ts.isBinaryExpression(expression) ||
    expression.operatorToken.kind !== ts.SyntaxKind.InstanceOfKeyword ||
    !ts.isIdentifier(expression.left) ||
    !ts.isIdentifier(expression.right)
  ) {
    return null;
  }
  const fields = context.classFields.get(expression.right.text);
  return fields === undefined
    ? null
    : { name: expression.left.text, className: expression.right.text, fields };
};

/** `String(value)` is `value.toString()`, which is what Dart calls it. */
const stringConversion = (
  expression: ts.Expression,
  context: TranslateContext,
): string | null => {
  if (!ts.isCallExpression(expression)) {
    return null;
  }
  const [only] = expression.arguments;
  if (
    !ts.isIdentifier(expression.expression) ||
    expression.expression.text !== 'String'
  ) {
    return null;
  }
  if (only === undefined || expression.arguments.length !== 1) {
    throw tsxErrorAt(
      'TSX0353',
      '`String(value)` converts one value: pass exactly one.',
      { sourceFile: context.sourceFile, node: expression },
    );
  }
  return `${translateExpression(only, context)}.toString()`;
};

const LOOSE_NULL_OPERATORS = new Map([
  [ts.SyntaxKind.EqualsEqualsToken, '=='],
  [ts.SyntaxKind.ExclamationEqualsToken, '!='],
]);

/** `value == null` / `value != null`, and nothing else loose. */
const nullComparisonDart = (
  expression: ts.BinaryExpression,
  context: TranslateContext,
): string | null => {
  const operator = LOOSE_NULL_OPERATORS.get(expression.operatorToken.kind);
  if (
    operator === undefined ||
    expression.right.kind !== ts.SyntaxKind.NullKeyword
  ) {
    return null;
  }
  return `${translateExpression(expression.left, context)} ${operator} null`;
};

const DART_MATH = 'dart:math';
const MATH_PREFIX = 'math';

// Dart puts rounding and absolute value on the number itself, which needs no
// import and reads the way Dart is written.
const NUMBER_METHODS = new Map([
  ['floor', 'floor'],
  ['ceil', 'ceil'],
  ['round', 'round'],
  ['abs', 'abs'],
  ['trunc', 'truncate'],
]);

// The rest are top-level functions in `dart:math`.
const MATH_FUNCTIONS = new Map([
  ['max', 'max'],
  ['min', 'min'],
  ['sqrt', 'sqrt'],
  ['pow', 'pow'],
  ['log', 'log'],
  ['sin', 'sin'],
  ['cos', 'cos'],
  ['tan', 'tan'],
]);

const MATH_CONSTANTS = new Map([
  ['PI', 'pi'],
  ['E', 'e'],
]);

/** `Math.floor(x)`, `Math.max(a, b)`, `Math.PI` — as Dart writes them. */
const translateMath = (
  expression: ts.Expression,
  context: TranslateContext,
): string | null => {
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'Math'
  ) {
    const constant = MATH_CONSTANTS.get(expression.name.text);
    if (constant === undefined) {
      return null;
    }
    context.useDartImport(DART_MATH, MATH_PREFIX);
    return `${MATH_PREFIX}.${constant}`;
  }
  if (
    !ts.isCallExpression(expression) ||
    !ts.isPropertyAccessExpression(expression.expression) ||
    !ts.isIdentifier(expression.expression.expression) ||
    expression.expression.expression.text !== 'Math'
  ) {
    return null;
  }
  const method = expression.expression.name.text;
  const args = expression.arguments.map((argument) =>
    translateExpression(argument, context),
  );
  const onNumber = NUMBER_METHODS.get(method);
  const [receiver] = args;
  if (onNumber !== undefined && args.length === 1 && receiver !== undefined) {
    const target = ts.isIdentifier(expression.arguments[0] as ts.Node)
      ? receiver
      : `(${receiver})`;
    return `${target}.${onNumber}()`;
  }
  const fn = MATH_FUNCTIONS.get(method);
  if (fn === undefined) {
    return null;
  }
  context.useDartImport(DART_MATH, MATH_PREFIX);
  return `${MATH_PREFIX}.${fn}(${args.join(', ')})`;
};

/** `json(body) as Album` — null when this is some other cast. */
const jsonDecodeDart = (
  expression: ts.AsExpression,
  context: TranslateContext,
): string | null => {
  const call = expression.expression;
  const model = ts.isTypeReferenceNode(expression.type)
    ? expression.type.typeName.getText()
    : '';
  const body = ts.isCallExpression(call) ? call.arguments[0] : undefined;
  if (
    !ts.isCallExpression(call) ||
    !ts.isIdentifier(call.expression) ||
    call.expression.text !== 'json' ||
    body === undefined ||
    !context.jsonModels.has(model)
  ) {
    return null;
  }
  context.useDartImport('dart:convert');
  const decoded = `jsonDecode(${translateExpression(body, context)}) as Map<String, dynamic>`;
  return `${model}.fromJson(${decoded})`;
};

// A read may continue through anything whose type is a known class: another
// read (`album.author.name`) or a call that returns one (`lookup().title`).
const nestedReadDart = (
  expression: ts.PropertyAccessExpression,
  context: TranslateContext,
): string | null => {
  const target = expression.expression;
  if (
    !(
      ts.isPropertyAccessExpression(target) ||
      ts.isCallExpression(target) ||
      ts.isParenthesizedExpression(target)
    ) ||
    readFieldType(expression, context) === null
  ) {
    return null;
  }
  return `${translateExpression(target, context)}.${expression.name.text}`;
};

const memberReadDart = (
  expression: ts.PropertyAccessExpression,
  info: MemberReadInfo,
  context: TranslateContext,
): string => {
  const member = expression.name.text;
  const field = info.fields.get(member);
  if (field === undefined) {
    throw tsxErrorAt(
      'TSX0315',
      `\`${info.className}\` has no property \`${member}\`. Check the ` +
        'API reference for the available properties.',
      { sourceFile: context.sourceFile, node: expression.name },
    );
  }
  if (!info.nullable) {
    return `${info.receiver}.${member}`;
  }
  // An access the source wrote as `?.` says the author handles null, so it
  // maps straight across and nothing is invented around it. Inside one the
  // checker reports the receiver as narrowed, which is true of the access and
  // not of the value, so narrowing is not consulted here either.
  if (expression.questionDotToken !== undefined) {
    return `${info.receiver}?.${member}`;
  }
  // A guard above this read has already excluded null.
  if (context.narrowed.has(expression.expression.getText())) {
    return `${info.receiver}!.${member}`;
  }
  const zero = zeroValueOf(field);
  if (zero === null) {
    throw tsxErrorAt(
      'TSX0316',
      `reading \`${member}\` on a value that may be null needs a guard: ` +
        `\`if (!${expression.expression.getText()}) return …;\` above it, ` +
        'or ' +
        `\`?.\` with a ${typeLabel(field)} fallback of your own.`,
      { sourceFile: context.sourceFile, node: expression.name },
    );
  }
  return `${info.receiver}?.${member} ?? ${zero}`;
};

const notYetCompiled = (node: ts.Node, context: TranslateContext): never => {
  throw tsxErrorAt(
    'TSX0305',
    `\`${node.getText()}\` is an expression form the compiler does not ` +
      'translate to Dart.',
    { sourceFile: context.sourceFile, node },
  );
};

export const translateIdentifier = (
  name: string,
  context: TranslateContext,
): string => {
  // A read of a module constant uses the Dart name that declaration took.
  const constant = dartConstantName(name);
  if (constant !== name) {
    return constant;
  }
  const isMember =
    context.stateNames.has(name) ||
    context.handlerNames.has(name) ||
    context.controllerNames.has(name);
  if (isMember && context.privateMembers) {
    return `_${name}`;
  }
  // A prop is a field of the widget, so a State reads it through `widget`.
  return context.widgetProps.has(name) ? `widget.${name}` : name;
};

/** `(x) => x.trim()` is the same closure in Dart. */
const translateArrow = (
  arrow: ts.ArrowFunction,
  context: TranslateContext,
): string => {
  const params = arrow.parameters.map((parameter) => {
    if (!ts.isIdentifier(parameter.name)) {
      throw tsxErrorAt(
        'TSX0338',
        'a callback parameter is one name: `(item) => …`.',
        { sourceFile: context.sourceFile, node: parameter },
      );
    }
    return parameter.name.text;
  });
  const { body } = arrow;
  if (ts.isBlock(body)) {
    throw tsxErrorAt(
      'TSX0338',
      'a callback here is one expression: `(item) => item.trim()`.',
      { sourceFile: context.sourceFile, node: body },
    );
  }
  return `(${params.join(', ')}) => ${translateExpression(body, context)}`;
};

/** Whether `$name` would run into what comes next: `'$counts'` is one name. */
const NAME_CONTINUES = /^[A-Za-z0-9_]/;

export const interpolate = (
  parts: { kind: 'text' | 'expr'; value: string }[],
): string => {
  const body = parts
    .map((part, index) => {
      if (part.kind === 'text') {
        return escapeDartString(part.value);
      }
      const next = parts[index + 1];
      const runsOn = next?.kind === 'text' && NAME_CONTINUES.test(next.value);
      return DART_IDENTIFIER.test(part.value) && !runsOn
        ? `$${part.value}`
        : `\${${part.value}}`;
    })
    .join('');
  return `'${body}'`;
};

const translateTemplate = (
  template: ts.TemplateExpression,
  context: TranslateContext,
): string => {
  const parts: { kind: 'text' | 'expr'; value: string }[] = [
    { kind: 'text', value: template.head.text },
  ];
  for (const span of template.templateSpans) {
    parts.push({
      kind: 'expr',
      value: translateExpression(span.expression, context),
    });
    parts.push({ kind: 'text', value: span.literal.text });
  }
  return interpolate(parts.filter((part) => part.value !== ''));
};

export const translateExpression = (
  expression: ts.Expression,
  context: TranslateContext,
): string => {
  if (ts.isNumericLiteral(expression)) {
    return expression.getText();
  }
  const math = translateMath(expression, context);
  if (math !== null) {
    return math;
  }
  const asString = stringConversion(expression, context);
  if (asString !== null) {
    return asString;
  }
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return 'null';
  }
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return 'true';
  }
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return 'false';
  }
  if (ts.isStringLiteral(expression)) {
    return `'${escapeDartString(expression.text)}'`;
  }
  if (ts.isNoSubstitutionTemplateLiteral(expression)) {
    return `'${escapeDartString(expression.text)}'`;
  }
  if (ts.isTemplateExpression(expression)) {
    return translateTemplate(expression, context);
  }
  if (ts.isIdentifier(expression)) {
    return translateIdentifier(expression.text, context);
  }
  if (ts.isParenthesizedExpression(expression)) {
    return `(${translateExpression(expression.expression, context)})`;
  }
  if (
    ts.isPrefixUnaryExpression(expression) &&
    (expression.operator === ts.SyntaxKind.ExclamationToken ||
      expression.operator === ts.SyntaxKind.MinusToken)
  ) {
    const operator =
      expression.operator === ts.SyntaxKind.ExclamationToken ? '!' : '-';
    return `${operator}${translateExpression(expression.operand, context)}`;
  }
  if (ts.isArrayLiteralExpression(expression)) {
    const elements = expression.elements.map((element) =>
      ts.isSpreadElement(element)
        ? `...${translateExpression(element.expression, context)}`
        : translateExpression(element, context),
    );
    return `[${elements.join(', ')}]`;
  }
  if (ts.isConditionalExpression(expression)) {
    const condition = translateExpression(expression.condition, context);
    const whenTrue = translateExpression(expression.whenTrue, context);
    const whenFalse = translateExpression(expression.whenFalse, context);
    return `${condition} ? ${whenTrue} : ${whenFalse}`;
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const member = context.enumMembers
      .get(expression.expression.text)
      ?.get(expression.name.text);
    if (member !== undefined) {
      return `${expression.expression.text}.${member}`;
    }
  }
  // `json(body) as Album` reads the same in a helper, a handler or a child, so
  // it is translated as an expression rather than only as a component local.
  if (ts.isAsExpression(expression)) {
    const decoded = jsonDecodeDart(expression, context);
    if (decoded !== null) {
      return decoded;
    }
  }
  if (ts.isPropertyAccessExpression(expression)) {
    if (ts.isIdentifier(expression.expression)) {
      const readInfo = context.memberReads.get(expression.expression.text);
      if (readInfo !== undefined) {
        return memberReadDart(expression, readInfo, context);
      }
    }
    const nested = nestedReadDart(expression, context);
    if (nested !== null) {
      return nested;
    }
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    SHARED_MEMBERS.has(expression.name.text)
  ) {
    const target = translateExpression(expression.expression, context);
    return `${target}.${expression.name.text}`;
  }
  if (ts.isElementAccessExpression(expression)) {
    const target = translateExpression(expression.expression, context);
    const index = translateExpression(expression.argumentExpression, context);
    // A tuple is a Dart record, whose fields are positional: `$1`, `$2`.
    const receiverType = ts.isIdentifier(expression.expression)
      ? context.localDartTypes.get(expression.expression.text)
      : undefined;
    if (
      receiverType?.startsWith('(') === true &&
      ts.isNumericLiteral(expression.argumentExpression)
    ) {
      return `${target}.$${Number(expression.argumentExpression.text) + 1}`;
    }
    // TypeScript types `names[0]` as `string | undefined`; Dart's `[]` throws
    // rather than returning null, so a list is read through elementAtOrNull
    // to mean what the TSX type says.
    const isList =
      ts.isIdentifier(expression.expression) &&
      listElementType(
        context.localDartTypes.get(expression.expression.text),
      ) !== null;
    return isList
      ? `${target}.elementAtOrNull(${index})`
      : `${target}[${index}]`;
  }
  if (ts.isArrowFunction(expression)) {
    return translateArrow(expression, context);
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    expression.expression.name.text === REDUCE
  ) {
    const [step, initial] = expression.arguments;
    if (step === undefined || initial === undefined) {
      throw tsxErrorAt(
        'TSX0338',
        '`reduce` needs an initial value: `xs.reduce((a, b) => a + b, 0)`.',
        { sourceFile: context.sourceFile, node: expression },
      );
    }
    const receiver = expression.expression.expression;
    const target = translateExpression(receiver, context);
    // Dart infers the accumulator from the initial value, so `fold(0, …)`
    // over a List<double> would be an int accumulator: name the type when
    // the element type is known.
    const element = ts.isIdentifier(receiver)
      ? listElementType(context.localDartTypes.get(receiver.text))
      : null;
    const typeArgument = element === null ? '' : `<${element}>`;
    return `${target}.fold${typeArgument}(${translateExpression(initial, context)}, ${translateExpression(step, context)})`;
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression)
  ) {
    const dartName = DART_METHODS.get(expression.expression.name.text);
    if (dartName === 'map') {
      requireSingleParameterCallback(expression, context);
    }
    if (dartName !== undefined) {
      const receiver = expression.expression.expression;
      const target = translateExpression(receiver, context);
      const itemContext = ELEMENT_CALLBACKS.has(expression.expression.name.text)
        ? withCallbackItem(
            context,
            expression.arguments[0] ?? expression,
            elementTypeOf(receiver, context),
          )
        : context;
      const args = expression.arguments.map((argument) =>
        translateExpression(argument, itemContext),
      );
      return `${target}.${dartName}(${args.join(', ')})`;
    }
    const alternative = METHOD_ALTERNATIVES.get(
      expression.expression.name.text,
    );
    if (alternative !== undefined) {
      throw tsxErrorAt(
        'TSX0341',
        `\`${expression.expression.name.text}\` has no Dart counterpart that ` +
          `behaves the same way — use ${alternative}.`,
        { sourceFile: context.sourceFile, node: expression.expression.name },
      );
    }
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    context.helperReturns.has(expression.expression.text)
  ) {
    const signature = context.helperReturns.get(expression.expression.text);
    const args = expression.arguments.map((argument, index) => {
      const declared = signature?.params[index]?.dartType ?? '';
      return (
        widenedNumberDart(argument, declared, context) ??
        translateExpression(argument, context)
      );
    });
    const name = context.privateHelpers.has(expression.expression.text)
      ? `_${expression.expression.text}`
      : expression.expression.text;
    return `${name}(${args.join(', ')})`;
  }
  // `new MediaType('text', 'plain')` — a value the plugin exports and you
  // build yourself. Dart writes the same call without the keyword.
  if (
    ts.isNewExpression(expression) &&
    ts.isIdentifier(expression.expression)
  ) {
    const className = expression.expression.text;
    const params = context.pluginConstructors.get(className);
    if (params === undefined) {
      throw tsxErrorAt(
        'TSX0349',
        `\`${className}\` is not a class this project can construct — a ` +
          'plugin exports the ones that are, and a model of your own is ' +
          'written as `{ field: value }`.',
        { sourceFile: context.sourceFile, node: expression.expression },
      );
    }
    const args = constructorArguments(expression, params, context);
    return `${className}(${args.join(', ')})`;
  }
  // `error instanceof CameraException` asks the same question Dart's `is`
  // asks, and answers it the same way — including the promotion that lets
  // the branch read the type's own members.
  if (
    ts.isBinaryExpression(expression) &&
    expression.operatorToken.kind === ts.SyntaxKind.InstanceOfKeyword
  ) {
    const test = instanceOfTest(expression, context);
    if (test === null) {
      throw tsxErrorAt(
        'TSX0352',
        'test a value the compiler knows against a class it knows: ' +
          '`if (error instanceof CameraException)`.',
        { sourceFile: context.sourceFile, node: expression },
      );
    }
    return `${translateIdentifier(test.name, context)} is ${test.className}`;
  }
  if (ts.isBinaryExpression(expression)) {
    // `x == null` is the one loose comparison TypeScript itself endorses, and
    // it means in Dart exactly what it means in TypeScript. Every other `==`
    // coerces, so it stays refused rather than compiling to something else.
    const nullComparison = nullComparisonDart(expression, context);
    if (nullComparison !== null) {
      return nullComparison;
    }
    const operator = BINARY_OPERATORS.get(expression.operatorToken.kind);
    if (operator === undefined) {
      return notYetCompiled(expression.operatorToken, context);
    }
    const left = translateExpression(expression.left, context);
    const right = translateExpression(expression.right, context);
    return `${left} ${operator} ${right}`;
  }
  if (ts.isCallExpression(expression)) {
    const pluginValue = context.pluginValueCall(expression);
    if (pluginValue !== null) {
      return pluginValue;
    }
  }
  return notYetCompiled(expression, context);
};
