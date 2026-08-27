import type { ClosureBody } from './dart-ast';
import type { IrStatement } from './ir';

export const methodStatementLines = (statements: IrStatement[]): string[] =>
  statements.flatMap((statement) =>
    statement.kind === 'dart'
      ? statement.line.split('\n')
      : [
          'setState(() {',
          ...statement.assignments.map((assignment) => `  ${assignment};`),
          '});',
        ],
  );

export const initStateLines = (statements: IrStatement[]): string[] =>
  statements.flatMap((statement) =>
    statement.kind === 'dart'
      ? statement.line.split('\n')
      : statement.assignments.map((assignment) => `${assignment};`),
  );

export const closureBodyOf = (statements: IrStatement[]): ClosureBody => {
  if (statements.length === 0) {
    return { kind: 'empty' };
  }
  const [first] = statements;
  if (statements.length === 1 && first?.kind === 'setState') {
    const [assignment] = first.assignments;
    if (first.assignments.length === 1 && assignment !== undefined) {
      return { kind: 'expression', code: `setState(() => ${assignment})` };
    }
  }
  return { kind: 'block', lines: methodStatementLines(statements) };
};
