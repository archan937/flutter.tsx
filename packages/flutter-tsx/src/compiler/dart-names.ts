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
