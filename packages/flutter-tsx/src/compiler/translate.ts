import ts from 'typescript';

import type { TypeNode } from '../api/model';
import { escapeDartString } from './dart-print';
import { tsxErrorAt } from './diagnostics';

export interface PluginReadInfo {
  className: string;
  nullable: boolean;
  fields: Map<string, TypeNode>;
}

export interface TranslateContext {
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  handlerNames: Set<string>;
  privateMembers: boolean;
  pluginReads: Map<string, PluginReadInfo>;
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

const pluginReadDart = (
  expression: ts.PropertyAccessExpression,
  info: PluginReadInfo,
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
  const target = `_${expression.expression.getText()}`;
  if (!info.nullable) {
    return `${target}.${member}`;
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
  return `${target}?.${member} ?? ${zero}`;
};

const notYetCompiled = (node: ts.Node, context: TranslateContext): never => {
  throw tsxErrorAt(
    'TSX0305',
    'this expression is not compiled yet (roadmap step 18).',
    { sourceFile: context.sourceFile, node },
  );
};

export const translateIdentifier = (
  name: string,
  context: TranslateContext,
): string => {
  const isMember =
    context.stateNames.has(name) || context.handlerNames.has(name);
  return isMember && context.privateMembers ? `_${name}` : name;
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
    const readInfo = context.pluginReads.get(expression.expression.text);
    if (readInfo !== undefined) {
      return pluginReadDart(expression, readInfo, context);
    }
  }
  if (
    ts.isPropertyAccessExpression(expression) &&
    SHARED_MEMBERS.has(expression.name.text)
  ) {
    const target = translateExpression(expression.expression, context);
    return `${target}.${expression.name.text}`;
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
