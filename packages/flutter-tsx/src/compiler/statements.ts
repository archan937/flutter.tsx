import type { ClosureBody } from './dart-ast';
import { printExpr } from './dart-print';
import type { IrStatement } from './ir';
import { type DartNaming, irValueToDart } from './ir-to-dart';

// Method bodies sit at indent 4, so an expression statement that has to wrap
// is printed against that column and split back into lines for the caller.
const METHOD_BODY_INDENT = 4;

const exprLines = (
  value: IrStatement & { kind: 'expr' },
  naming: DartNaming,
): string[] => {
  const printed = printExpr(irValueToDart(value.value, naming), {
    indent: METHOD_BODY_INDENT,
    used: METHOD_BODY_INDENT,
    trailing: 1,
  });
  return `${printed};`.split('\n');
};

// initState assigns state directly; anywhere else the same assignment has to
// go through setState. Everything else renders identically, so both callers
// share one walk over the statements.
const statementLines = (
  statements: IrStatement[],
  naming: DartNaming,
  wrapSetState: boolean,
): string[] =>
  statements.flatMap((statement) => {
    switch (statement.kind) {
      case 'dart':
        return statement.line.split('\n');
      case 'expr':
        return exprLines(statement, naming);
      case 'postFrame':
        return [
          'WidgetsBinding.instance.addPostFrameCallback((_) {',
          ...statementLines(statement.statements, naming, true).map(
            (line) => `  ${line}`,
          ),
          '});',
        ];
      default:
        return wrapSetState
          ? [
              'setState(() {',
              ...statement.assignments.map((assignment) => `  ${assignment};`),
              '});',
            ]
          : statement.assignments.map((assignment) => `${assignment};`);
    }
  });

export const methodStatementLines = (
  statements: IrStatement[],
  naming: DartNaming = { privateMembers: true },
): string[] => statementLines(statements, naming, true);

export const initStateLines = (
  statements: IrStatement[],
  naming: DartNaming = { privateMembers: true },
): string[] => statementLines(statements, naming, false);

export const closureBodyOf = (
  statements: IrStatement[],
  naming: DartNaming = { privateMembers: true },
): ClosureBody => {
  if (statements.length === 0) {
    return { kind: 'empty' };
  }
  const [first] = statements;
  if (statements.length === 1 && first !== undefined) {
    // A lone expression stays a value so the printer can wrap it in place.
    if (first.kind === 'expr') {
      return { kind: 'value', value: irValueToDart(first.value, naming) };
    }
    // One single-line statement reads better as an expression body, the same
    // way a lone setState already does.
    if (
      first.kind === 'dart' &&
      !first.line.includes('\n') &&
      first.line.endsWith(';')
    ) {
      return { kind: 'expression', code: first.line.slice(0, -1) };
    }
    if (first.kind === 'setState') {
      const [assignment] = first.assignments;
      if (first.assignments.length === 1 && assignment !== undefined) {
        return { kind: 'expression', code: `setState(() => ${assignment})` };
      }
    }
  }
  return { kind: 'block', lines: methodStatementLines(statements, naming) };
};
