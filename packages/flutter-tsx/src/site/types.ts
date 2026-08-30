import { extractDeclarations } from './declarations';
import type { SiteType, SiteWidget } from './model';

const VALUE_TYPE = /^(.+)Value$/;
const OBJECT_SUFFIX = 'Object';

/**
 * The value types a developer writes into a prop.
 *
 * Read from the generated widget declarations that ship in the package, so
 * every spelling documented here is one the TypeScript compiler already
 * accepts on the props it appears in — the shape column is the shipped
 * `…Object` interface, not a description of it.
 */
export const buildSiteTypes = (
  generatedFiles: string[],
  widgets: SiteWidget[],
): SiteType[] => {
  const declared = extractDeclarations(generatedFiles);
  const shapes = new Map(
    declared
      .filter((entry) => entry.name.endsWith(OBJECT_SUFFIX))
      .map((entry) => [entry.name, entry.signature]),
  );

  const usedIn = (tsType: string): string[] =>
    widgets
      .filter((widget) =>
        widget.props.some((prop) => prop.tsType.split(' | ').includes(tsType)),
      )
      .map((widget) => widget.name);

  const types: SiteType[] = [];
  for (const entry of declared) {
    const match = VALUE_TYPE.exec(entry.name);
    if (entry.kind !== 'type' || match === null) continue;
    const base = match[1] ?? '';
    types.push({
      name: entry.name,
      dartType: base,
      accepts: entry.signature,
      shape: shapes.get(`${base}${OBJECT_SUFFIX}`) ?? null,
      doc: entry.doc,
      usedBy: usedIn(entry.name),
    });
  }

  return types.sort((first, second) => first.name.localeCompare(second.name));
};
