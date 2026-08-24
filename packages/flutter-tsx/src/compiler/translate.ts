import ts from 'typescript';

import { escapeDartString } from './dart-print';
import { tsxErrorAt } from './diagnostics';

export interface TranslateContext {
  sourceFile: ts.SourceFile;
  stateNames: Set<string>;
  handlerNames: Set<string>;
  privateMembers: boolean;
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
