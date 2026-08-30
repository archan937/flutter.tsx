import ts from 'typescript';

import type { TypeNode } from '../api/model';
import { listElementType } from './dart-names';
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
  /** Records a Dart import the translation needs, e.g. `dart:convert`. */
  useDartImport: (uri: string) => void;
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
]);

// `reduce` and `fold` mean the same thing with the arguments the other way
// round: JS takes (step, initial), Dart takes (initial, step).
const REDUCE = 'reduce';

/** Of those, the ones that produce a String whatever the receiver is. */
export const STRING_RETURNING_METHODS = new Set([
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
  const zero = zeroValueOf(field);
  if (zero === null) {
    throw tsxErrorAt(
      'TSX0316',
      `reading \`${member}\` needs a ${typeLabel(field)} fallback, which ` +
        'is not compiled yet. Read it inside a handler and store the result ' +
        'in state.',
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
  const isMember =
    context.stateNames.has(name) || context.handlerNames.has(name);
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

export const interpolate = (
  parts: { kind: 'text' | 'expr'; value: string }[],
): string => {
  const body = parts
    .map((part) => {
      if (part.kind === 'text') {
        return escapeDartString(part.value);
      }
      return DART_IDENTIFIER.test(part.value)
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
    if (dartName !== undefined) {
      const target = translateExpression(
        expression.expression.expression,
        context,
      );
      const args = expression.arguments.map((argument) =>
        translateExpression(argument, context),
      );
      return `${target}.${dartName}(${args.join(', ')})`;
    }
  }
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    context.helperReturns.has(expression.expression.text)
  ) {
    const args = expression.arguments.map((argument) =>
      translateExpression(argument, context),
    );
    const name = context.privateHelpers.has(expression.expression.text)
      ? `_${expression.expression.text}`
      : expression.expression.text;
    return `${name}(${args.join(', ')})`;
  }
  if (ts.isBinaryExpression(expression)) {
    const operator = BINARY_OPERATORS.get(expression.operatorToken.kind);
    if (operator === undefined) {
      return notYetCompiled(expression.operatorToken, context);
    }
    const left = translateExpression(expression.left, context);
    const right = translateExpression(expression.right, context);
    return `${left} ${operator} ${right}`;
  }
  return notYetCompiled(expression, context);
};
