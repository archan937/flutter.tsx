import ts from 'typescript';

import { tsxErrorAt } from './diagnostics';

/**
 * TSX Strict Mode: the features Flutter.tsx refuses outright.
 *
 * Each one is refused by name, with the reason, rather than reaching the
 * lowering as a vague "not compiled yet" — the developer learns what Dart
 * cannot express and what to write instead.
 */
interface Forbidden {
  code: string;
  reason: string;
}

const GLOBALS = new Map<string, Forbidden>([
  [
    'Proxy',
    { code: 'TSX1003', reason: 'Dart has no dynamic property trapping' },
  ],
  ['Symbol', { code: 'TSX1004', reason: 'Dart has no equivalent' }],
  ['WeakMap', { code: 'TSX1005', reason: 'Dart has no equivalent' }],
  ['WeakSet', { code: 'TSX1005', reason: 'Dart has no equivalent' }],
  ['WeakRef', { code: 'TSX1005', reason: 'Dart has no equivalent' }],
  ['Reflect', { code: 'TSX2005', reason: 'Dart has no reflection at runtime' }],
]);

const CALLS = new Map<string, Forbidden>([
  ['eval', { code: 'TSX1002', reason: 'Dart generates no code at runtime' }],
  ['require', { code: 'TSX3002', reason: 'use an `import` declaration' }],
]);

const PROTOTYPE = 'prototype';
const OBJECT = 'Object';
const ASSIGN = 'assign';
const SET_PROTOTYPE_OF = 'setPrototypeOf';

const isNullish = (type: ts.TypeNode): boolean =>
  type.kind === ts.SyntaxKind.NullKeyword ||
  type.kind === ts.SyntaxKind.UndefinedKeyword ||
  (ts.isLiteralTypeNode(type) &&
    type.literal.kind === ts.SyntaxKind.NullKeyword);

const isStringLiteralType = (type: ts.TypeNode): boolean =>
  ts.isLiteralTypeNode(type) && ts.isStringLiteral(type.literal);

/**
 * A union Dart can hold: `T | null` is a nullable T, and a union of string
 * literals is a String. Anything else has no single Dart type.
 */
const isSupportedUnion = (type: ts.UnionTypeNode): boolean => {
  const members = type.types.filter((member) => !isNullish(member));
  return members.length <= 1 || members.every(isStringLiteralType);
};

const containsInfer = (type: ts.TypeNode): boolean => {
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isInferTypeNode(node)) found = true;
    ts.forEachChild(node, visit);
  };
  visit(type);
  return found;
};

/** The forbidden feature this node is, if it is one. */
const forbiddenAt = (node: ts.Node): Forbidden | null => {
  if (node.kind === ts.SyntaxKind.AnyKeyword) {
    return { code: 'TSX1001', reason: 'Dart has no dynamic typing' };
  }
  if (ts.isTypeOfExpression(node)) {
    return { code: 'TSX1008', reason: 'types are erased at runtime' };
  }
  if (ts.isIndexSignatureDeclaration(node)) {
    return { code: 'TSX1009', reason: 'use a `Map<K, V>` instead' };
  }
  if (ts.isModuleDeclaration(node)) {
    return { code: 'TSX1010', reason: 'Dart has no equivalent' };
  }
  if (ts.isMappedTypeNode(node)) {
    return { code: 'TSX2002', reason: 'Dart has no mapped types' };
  }
  if (ts.isConditionalTypeNode(node)) {
    // `infer` only ever appears inside a conditional type, so it is reported
    // by its own code rather than the broader one.
    return containsInfer(node.extendsType)
      ? { code: 'TSX2004', reason: 'Dart cannot infer a type here' }
      : { code: 'TSX2003', reason: 'Dart has no conditional types' };
  }
  if (ts.isUnionTypeNode(node) && !isSupportedUnion(node)) {
    return {
      code: 'TSX2001',
      reason:
        'a value has one Dart type; `T | null` and string literals are fine',
    };
  }
  if (
    (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node)) &&
    node.asteriskToken !== undefined
  ) {
    return { code: 'TSX2006', reason: 'Dart has no generator functions' };
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    return { code: 'TSX3001', reason: 'imports are resolved at compile time' };
  }
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
    return CALLS.get(node.expression.text) ?? null;
  }
  if (ts.isPropertyAccessExpression(node)) {
    if (node.name.text === PROTOTYPE) {
      return { code: 'TSX1006', reason: 'Dart is not a prototype language' };
    }
    if (
      ts.isIdentifier(node.expression) &&
      node.expression.text === OBJECT &&
      (node.name.text === ASSIGN || node.name.text === SET_PROTOTYPE_OF)
    ) {
      return node.name.text === ASSIGN
        ? { code: 'TSX1007', reason: 'use spread: `{ ...a, ...b }`' }
        : { code: 'TSX1006', reason: 'Dart is not a prototype language' };
    }
  }
  if (ts.isIdentifier(node)) {
    return GLOBALS.get(node.text) ?? null;
  }
  return null;
};

const isAmbient = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts
    .getModifiers(node)
    ?.some((modifier) => modifier.kind === ts.SyntaxKind.DeclareKeyword) ??
    false);

/** Raises on the first forbidden construct in the file. */
export const checkStrictMode = (sourceFile: ts.SourceFile): void => {
  const visit = (node: ts.Node): void => {
    if (isAmbient(node)) {
      throw tsxErrorAt(
        'TSX1011',
        'a `declare` is compile-time only: Flutter.tsx compiles what runs.',
        { sourceFile, node },
      );
    }
    const forbidden = forbiddenAt(node);
    if (forbidden !== null) {
      throw tsxErrorAt(
        forbidden.code,
        `\`${node.getText(sourceFile).split('\n')[0]}\` is not compiled: ${forbidden.reason}.`,
        { sourceFile, node },
      );
    }
    // The member name of `a.b` is not a reference to anything global, so only
    // the receiver is walked.
    if (ts.isPropertyAccessExpression(node)) {
      visit(node.expression);
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
};
