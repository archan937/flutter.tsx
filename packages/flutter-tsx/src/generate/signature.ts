import type { ParamModel } from '../api/model';

/**
 * Dart's parameter shape, written the way TypeScript writes it.
 *
 * Dart has positional parameters and named ones; TypeScript has positional
 * parameters and an object. So a call keeps its positional arguments and
 * gathers the named ones into a trailing `options` — the shape every
 * generated signature uses, whether it comes from the SDK or a plugin, so
 * the two can never drift apart.
 */
export const signatureParams = (
  params: readonly ParamModel[],
  typeOf: (param: ParamModel) => string,
): string => {
  const written = (param: ParamModel): string =>
    `${param.name}${param.required ? '' : '?'}: ${typeOf(param)}`;
  const positional = params.filter((param) => !param.named).map(written);
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
