export const JSX_PROP_RENAMES: Record<string, string> = {
  onPressed: 'onClick',
  onTap: 'onClick',
};

export const jsxPropName = (
  paramName: string,
  takenNames: ReadonlySet<string>,
): string => {
  const renamed = JSX_PROP_RENAMES[paramName];
  if (renamed !== undefined && !takenNames.has(renamed)) {
    return renamed;
  }
  return paramName;
};
