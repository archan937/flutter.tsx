import type { ParamModel } from '../api/model';

/**
 * Dart's parameter shape, written the way TypeScript writes it.
 *
 * Dart has positional parameters and named ones; TypeScript has positional
 * parameters and an object. So a call keeps its positional arguments and
 * gathers the named ones into a trailing `options` — the shape every
 * generated signature uses, whether it comes from the SDK or a plugin, so
 * the two can never drift apart.
 *
 * Names a TypeScript parameter cannot take.
 *
 * Dart has parameters called `arguments` and `eval`; in a module, which is
 * always strict, TypeScript refuses those as parameter names. They are the
 * declaration's own names, so renaming one changes nothing about the call.
 */
const TS_RESERVED_PARAMS: ReadonlySet<string> = new Set([
  'arguments',
  'eval',
  'function',
  'class',
  'default',
  'new',
  'this',
  'typeof',
  'void',
  'in',
  'of',
  'for',
  'if',
  'else',
  'return',
  'switch',
  'case',
  'catch',
  'try',
  'throw',
  'while',
  'do',
  'delete',
  'var',
  'let',
  'const',
  'null',
  'true',
  'false',
  'super',
  'extends',
  'import',
  'export',
  'enum',
]);

/** The name a parameter takes in TypeScript, which may not be Dart's. */
export const writtenParamName = (name: string): string =>
  TS_RESERVED_PARAMS.has(name) ? `${name}_` : name;

export const signatureParams = (
  params: readonly ParamModel[],
  typeOf: (param: ParamModel) => string,
): string => {
  const written = (param: ParamModel): string =>
    `${param.name}${param.required ? '' : '?'}: ${typeOf(param)}`;
  const positional = params
    .filter((param) => !param.named)
    .map((param) => written({ ...param, name: writtenParamName(param.name) }));
  const named = params.filter((param) => param.named);
  if (named.length === 0) {
    return positional.join(', ');
  }
  const optional = named.every((param) => !param.required) ? '?' : '';
  return [
    ...positional,
    `options${optional}: { ${named.map(written).join('; ')} }`,
  ].join(', ');
};
