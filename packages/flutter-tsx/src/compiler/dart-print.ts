import type { DartArgument, DartExpr, DartListItem } from './dart-ast';

const MAX_WIDTH = 80;

export interface PrintSite {
  indent: number;
  used: number;
  trailing: number;
}

const ROOT_SITE: PrintSite = { indent: 0, used: 0, trailing: 0 };

export const escapeDartString = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('$', '\\$');

const pad = (width: number): string => ' '.repeat(width);

const inlineArgument = (argument: DartArgument): string => {
  const value = inlineExpr(argument.value);
  return argument.name === null ? value : `${argument.name}: ${value}`;
};

const inlineListItem = (item: DartListItem): string =>
  item.kind === 'element'
    ? inlineExpr(item.value)
    : `if (${inlineExpr(item.condition)}) ${inlineExpr(item.value)}`;

const inlineExpr = (expr: DartExpr): string => {
  switch (expr.kind) {
    case 'string':
      return `'${escapeDartString(expr.value)}'`;
    case 'number':
      return expr.value;
    case 'boolean':
      return expr.value ? 'true' : 'false';
    case 'identifier':
      return expr.name;
    case 'enumMember':
      return `${expr.enumName}.${expr.member}`;
    case 'call': {
      const constPrefix = expr.isConst ? 'const ' : '';
      const args = expr.args.map(inlineArgument).join(', ');
      return `${constPrefix}${expr.target}(${args})`;
    }
    case 'closure': {
      const params = `(${expr.params.join(', ')})`;
      if (expr.body.kind === 'expression') {
        return `${params} => ${expr.body.code}`;
      }
      // A block body embeds newlines so any enclosing call is forced tall
      // and re-renders it through printExpr with a real site.
      return expr.body.kind === 'empty'
        ? `${params} {}`
        : `${params} {\n${expr.body.lines.join('\n')}\n}`;
    }
    case 'conditional':
      return (
        `${inlineExpr(expr.condition)} ? ` +
        `${inlineExpr(expr.whenTrue)} : ${inlineExpr(expr.whenFalse)}`
      );
    case 'list': {
      const constPrefix = expr.isConst ? 'const ' : '';
      return expr.items.length === 0
        ? `${constPrefix}[]`
        : `${constPrefix}[${expr.items.map(inlineListItem).join(', ')}]`;
    }
  }
};

// dart format's tall style splits a collection argument whenever its
// enclosing argument list splits, even when the collection alone would fit.
const printArgumentValue = (expr: DartExpr, site: PrintSite): string =>
  expr.kind === 'list' && expr.items.length > 0
    ? printListTall(expr, site)
    : printExpr(expr, site);

const printCallTall = (
  expr: Extract<DartExpr, { kind: 'call' }>,
  site: PrintSite,
): string => {
  const constPrefix = expr.isConst ? 'const ' : '';
  const childIndent = site.indent + 2;
  const lines = expr.args.map((argument) => {
    const prefix = argument.name === null ? '' : `${argument.name}: `;
    const value = printArgumentValue(argument.value, {
      indent: childIndent,
      used: childIndent + prefix.length,
      trailing: 1,
    });
    return `${pad(childIndent)}${prefix}${value},`;
  });
  return (
    `${constPrefix}${expr.target}(\n` +
    `${lines.join('\n')}\n` +
    `${pad(site.indent)})`
  );
};

const printListTall = (
  expr: Extract<DartExpr, { kind: 'list' }>,
  site: PrintSite,
): string => {
  const childIndent = site.indent + 2;
  const lines = expr.items.map((item) => {
    const prefix =
      item.kind === 'if' ? `if (${inlineExpr(item.condition)}) ` : '';
    const value = printExpr(item.value, {
      indent: childIndent,
      used: childIndent + prefix.length,
      trailing: 1,
    });
    return `${pad(childIndent)}${prefix}${value},`;
  });
  const constPrefix = expr.isConst ? 'const ' : '';
  return `${constPrefix}[\n${lines.join('\n')}\n${pad(site.indent)}]`;
};

const printClosureBlock = (
  params: string[],
  body: { lines: string[] },
  site: PrintSite,
): string => {
  const lines = body.lines.map((line) => `${pad(site.indent + 2)}${line}`);
  return `(${params.join(', ')}) {\n${lines.join('\n')}\n${pad(site.indent)}}`;
};

const printConditionalTall = (
  expr: Extract<DartExpr, { kind: 'conditional' }>,
  site: PrintSite,
): string => {
  const childIndent = site.indent + 4;
  return (
    `${inlineExpr(expr.condition)}\n` +
    `${pad(childIndent)}? ${inlineExpr(expr.whenTrue)}\n` +
    `${pad(childIndent)}: ${inlineExpr(expr.whenFalse)}`
  );
};

export const printExpr = (
  expr: DartExpr,
  site: PrintSite = ROOT_SITE,
): string => {
  if (expr.kind === 'closure' && expr.body.kind === 'block') {
    return printClosureBlock(expr.params, expr.body, site);
  }
  const inline = inlineExpr(expr);
  if (site.used + inline.length + site.trailing <= MAX_WIDTH) {
    return inline;
  }
  if (expr.kind === 'call' && expr.args.length > 0) {
    return printCallTall(expr, site);
  }
  if (expr.kind === 'list' && expr.items.length > 0) {
    return printListTall(expr, site);
  }
  if (expr.kind === 'conditional') {
    return printConditionalTall(expr, site);
  }
  return inline;
};
