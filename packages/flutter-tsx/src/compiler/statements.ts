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
  // The lines are indented by whoever emits the body, so they are printed
  // relative to the statement itself: a continuation sits two spaces in, and
  // the width is measured from where the statement actually starts.
  const printed = printExpr(irValueToDart(value.value, naming), {
    indent: 0,
    used: METHOD_BODY_INDENT,
    trailing: 1,
  });
  return `${printed};`.split('\n');
};

const indent = (lines: string[]): string[] => lines.map((line) => `  ${line}`);

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
      case 'if': {
        const branch = statementLines(statement.then, naming, wrapSetState);
        const lines = [
          `if (${statement.condition}) {`,
          ...branch.map((line) => `  ${line}`),
        ];
        if (statement.otherwise.length === 0) {
          return [...lines, '}'];
        }
        const [only] = statement.otherwise;
        // A lone `if` in the else branch is an `else if`, not a nested block.
        if (statement.otherwise.length === 1 && only?.kind === 'if') {
          const [head, ...rest] = statementLines([only], naming, wrapSetState);
          return [...lines, `} else ${head ?? ''}`, ...rest];
        }
        return [
          ...lines,
          '} else {',
          ...statementLines(statement.otherwise, naming, wrapSetState).map(
            (line) => `  ${line}`,
          ),
          '}',
        ];
      }
      case 'try':
        return [
          'try {',
          ...indent(statementLines(statement.body, naming, wrapSetState)),
          ...(statement.onError === null
            ? []
            : [
                `} catch (${statement.onError.error}) {`,
                ...indent(
                  statementLines(statement.onError.body, naming, wrapSetState),
                ),
              ]),
          ...(statement.onFinally === null
            ? []
            : [
                '} finally {',
                ...indent(
                  statementLines(statement.onFinally, naming, wrapSetState),
                ),
              ]),
          '}',
        ];
      case 'forOf':
        return [
          `for (final ${statement.itemName} in ${statement.iterable}) {`,
          ...indent(statementLines(statement.body, naming, wrapSetState)),
          '}',
        ];
      case 'while':
        return [
          `while (${statement.condition}) {`,
          ...indent(statementLines(statement.body, naming, wrapSetState)),
          '}',
        ];
      case 'switch':
        return [
          `switch (${statement.value}) {`,
          ...statement.cases.flatMap((entry) => [
            ...entry.values.map((value) => `  case ${value}:`),
            ...indent(indent(statementLines(entry.body, naming, wrapSetState))),
            '    break;',
          ]),
          ...(statement.fallback === null
            ? []
            : [
                '  default:',
                ...indent(
                  indent(
                    statementLines(statement.fallback, naming, wrapSetState),
                  ),
                ),
              ]),
          '}',
        ];
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
