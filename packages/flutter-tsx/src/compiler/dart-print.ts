import type { DartArgument, DartExpr, DartListItem } from './dart-ast';

const INDENT = '  ';

const escapeString = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('$', '\\$');

const indentBlock = (block: string): string =>
  block
    .split('\n')
    .map((line) => `${INDENT}${line}`)
    .join('\n');

const printArgument = (argument: DartArgument): string => {
  const value = printExpr(argument.value);
  return argument.name === null ? value : `${argument.name}: ${value}`;
};

const printListItem = (item: DartListItem): string =>
  item.kind === 'element'
    ? printExpr(item.value)
    : `if (${printExpr(item.condition)}) ${printExpr(item.value)}`;

const printCall = (expr: Extract<DartExpr, { kind: 'call' }>): string => {
  const constPrefix = expr.isConst ? 'const ' : '';
  const printedArgs = expr.args.map(printArgument);
  const inline = `${constPrefix}${expr.target}(${printedArgs.join(', ')})`;
  const fitsInline =
    inline.length <= 60 && printedArgs.every((arg) => !arg.includes('\n'));
  if (printedArgs.length === 0 || fitsInline) {
    return inline;
  }
  const body = printedArgs
    .map((argument) => `${indentBlock(argument)},`)
    .join('\n');
  return `${constPrefix}${expr.target}(\n${body}\n)`;
};

const printList = (expr: Extract<DartExpr, { kind: 'list' }>): string => {
  if (expr.items.length === 0) {
    return '[]';
  }
  const body = expr.items
    .map((item) => `${indentBlock(printListItem(item))},`)
    .join('\n');
  return `[\n${body}\n]`;
};

export const printExpr = (expr: DartExpr): string => {
  switch (expr.kind) {
    case 'string':
      return `'${escapeString(expr.value)}'`;
    case 'number':
      return expr.value;
    case 'boolean':
      return expr.value ? 'true' : 'false';
    case 'identifier':
      return expr.name;
    case 'enumMember':
      return `${expr.enumName}.${expr.member}`;
    case 'call':
      return printCall(expr);
    case 'list':
      return printList(expr);
  }
};
