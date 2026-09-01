/**
 * Converts a component file name to its Dart file name, keeping the directory
 * it lives in: `widgets/UserCard.tsx` becomes `widgets/user_card.dart`.
 */
export const dartFileFor = (componentFile: string): string => {
  const separator = componentFile.lastIndexOf('/');
  const directory = componentFile.slice(0, separator + 1);
  const base = componentFile.slice(separator + 1).replace(/\.tsx$/, '');
  const snake = base
    // `HTTPClient` splits before the last capital of a run, not inside it.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase();
  return `${directory}${snake}.dart`;
};

const LIST_OF = /^List<(.+)>$/;

/** What a `List<T>` holds; null when the type is not a list. */
/**
 * `ALBUMS` → `albums`: the Dart name of a module constant.
 *
 * Dart names constants in lowerCamelCase and the analyzer says so
 * (`constant_identifier_names`), while TypeScript often shouts them. The
 * shape is unmistakable — no other binding in TSX is all capitals — so the
 * rename needs no bookkeeping: the declaration and every read of it derive
 * the same name from the same rule.
 */
export const dartConstantName = (tsxName: string): string => {
  if (!/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(tsxName)) {
    return tsxName;
  }
  const [first = '', ...rest] = tsxName.toLowerCase().split('_');
  return [
    first,
    ...rest.map((part) => part.charAt(0).toUpperCase() + part.slice(1)),
  ].join('');
};

export const listElementType = (dartType: string | undefined): string | null =>
  dartType === undefined ? null : (LIST_OF.exec(dartType)?.[1] ?? null);

/** The type of a record's nth field: `(String, double)` at 0 is String. */
export const recordFieldType = (
  dartType: string | undefined,
  index: number,
): string | null => {
  if (!dartType?.startsWith('(')) return null;
  return dartType.slice(1, -1).split(', ')[index] ?? null;
};
