import type {
  BuilderBind,
  DartArgument,
  DartExpr,
  DartListItem,
} from './dart-ast';

export const MAX_WIDTH = 80;

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

const listItemPrefix = (item: DartListItem): string => {
  if (item.kind === 'if') {
    return `if (${inlineExpr(item.condition)}) `;
  }
  if (item.kind === 'for') {
    return `for (final ${item.itemName} in ${inlineExpr(item.iterable)}) `;
  }
  return '';
};

const inlineListItem = (item: DartListItem): string =>
  `${listItemPrefix(item)}${inlineExpr(item.value)}`;

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
      if (expr.body.kind === 'value') {
        return `${params} => ${inlineExpr(expr.body.value)}`;
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
    // Never inline: the newlines force every enclosing call tall, which is
    // what dart format does with a block-bodied closure argument.
    case 'builder':
      return `(${expr.params.join(', ')}) {\n}`;
  }
};

// An element that carries named arguments of its own keeps a collection
// tall — only the element's own argument list counts, not one nested deeper.
const blocksHug = (item: DartListItem): boolean =>
  item.value.kind === 'call' &&
  item.value.args.some((argument) => argument.name !== null);

// A collection argument stays on its line when it fits there and no element
// carries named arguments of its own — verified against dart format, which
// collapses a hand-split collection in either a sole-argument or a
// multi-argument call.
const printArgumentValue = (expr: DartExpr, site: PrintSite): string => {
  if (expr.kind !== 'list' || expr.items.length === 0) {
    return printExpr(expr, site);
  }
  return expr.items.some(blocksHug)
    ? printListTall(expr, site)
    : printExpr(expr, site);
};

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
    const prefix = listItemPrefix(item);
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

const printBuilder = (
  expr: Extract<DartExpr, { kind: 'builder' }>,
  site: PrintSite,
): string => {
  const bodyIndent = site.indent + 2;
  const returnLine = (value: DartExpr, indent: number): string => {
    const printed = printExpr(value, {
      indent,
      used: indent + 'return '.length,
      trailing: 1,
    });
    return `${pad(indent)}return ${printed};`;
  };
  const bindLine = (bind: BuilderBind, indent: number): string => {
    const prefix = `final ${bind.name} = `;
    const printed = printExpr(bind.value, {
      indent,
      used: indent + prefix.length,
      trailing: 1,
    });
    return `${pad(indent)}${prefix}${printed};`;
  };

  const lines: string[] = [];
  for (const guard of expr.guards) {
    const guardIndent = bodyIndent + 2;
    lines.push(`${pad(bodyIndent)}if (${guard.condition}) {`);
    if (guard.bind !== null) {
      lines.push(bindLine(guard.bind, guardIndent));
    }
    lines.push(returnLine(guard.value, guardIndent), `${pad(bodyIndent)}}`);
  }
  for (const bind of expr.binds) {
    lines.push(bindLine(bind, bodyIndent));
  }
  lines.push(returnLine(expr.value, bodyIndent));
  return (
    `(${expr.params.join(', ')}) {\n` +
    `${lines.join('\n')}\n` +
    `${pad(site.indent)}}`
  );
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
  if (expr.kind === 'closure' && expr.body.kind === 'value') {
    const params = `(${expr.params.join(', ')}) => `;
    return (
      params +
      printExpr(expr.body.value, {
        indent: site.indent,
        used: site.used + params.length,
        trailing: site.trailing,
      })
    );
  }
  if (expr.kind === 'builder') {
    return printBuilder(expr, site);
  }
  const inline = inlineExpr(expr);
  // A form that already spans lines can never fit on one, however short its
  // first line looks — block-bodied closures and builders rely on this.
  if (
    !inline.includes('\n') &&
    site.used + inline.length + site.trailing <= MAX_WIDTH
  ) {
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
