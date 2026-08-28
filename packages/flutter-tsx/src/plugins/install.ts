/**
 * Installing the plugins a project declares.
 *
 * `package.json` is the single source of truth: its `"plugins"` map names pub
 * packages and their constraints. fsx never edits `pubspec.yaml` itself — it
 * drives `flutter pub add` / `pub remove`, which own that file — and records
 * what it installed so a later run can tell an unchanged plugin from a
 * retracted one.
 */

const PLUGINS_KEY = 'plugins';

export type PluginConstraints = Record<string, string>;

export interface PluginSyncPlan {
  /** `pub add` descriptors, e.g. `camera@^0.12.0`. */
  add: string[];
  /** Bare package names for `pub remove`. */
  remove: string[];
}

export const readPluginDependencies = (
  manifestText: string,
  label: string,
): PluginConstraints => {
  let document: unknown;
  try {
    document = JSON.parse(manifestText);
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
  if (typeof document !== 'object' || document === null) {
    throw new Error(`${label} is not valid JSON.`);
  }
  const declared = (document as Record<string, unknown>)[PLUGINS_KEY];
  if (declared === undefined) return {};
  if (
    typeof declared !== 'object' ||
    declared === null ||
    Array.isArray(declared)
  ) {
    throw new Error(
      `${label}: "${PLUGINS_KEY}" must be an object of pub constraints.`,
    );
  }
  const constraints: PluginConstraints = {};
  for (const [name, constraint] of Object.entries(declared)) {
    if (typeof constraint !== 'string') {
      throw new Error(
        `${label}: "${PLUGINS_KEY}.${name}" must be a version constraint.`,
      );
    }
    constraints[name] = constraint;
  }
  return constraints;
};

export const planPluginSync = (
  declared: PluginConstraints,
  installed: PluginConstraints,
): PluginSyncPlan => ({
  add: Object.entries(declared)
    .filter(([name, constraint]) => installed[name] !== constraint)
    .map(([name, constraint]) => `${name}@${constraint}`)
    .sort(),
  remove: Object.keys(installed)
    .filter((name) => declared[name] === undefined)
    .sort(),
});

const PACKAGES_BLOCK = 'packages:';
const PACKAGE_INDENT = 2;
const FIELD_INDENT = 4;

const unquoted = (value: string): string => value.replace(/^"(.*)"$/, '$1');

/**
 * Reads the exact version pub resolved for each package from `pubspec.lock`.
 *
 * The lock file is machine-written with a fixed two-space shape, so the block
 * is read positionally rather than by pulling in a YAML parser.
 */
export const resolvedVersions = (lockText: string): PluginConstraints => {
  const versions: PluginConstraints = {};
  let currentPackage: string | null = null;
  let inPackages = false;

  for (const line of lockText.split('\n')) {
    if (line.startsWith(PACKAGES_BLOCK)) {
      inPackages = line.slice(PACKAGES_BLOCK.length).trim() === '';
      continue;
    }
    if (!inPackages) continue;
    if (line.trim() === '') continue;

    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      inPackages = false;
      continue;
    }
    if (indent === PACKAGE_INDENT) {
      currentPackage = line.trim().replace(/:$/, '');
      continue;
    }
    if (indent === FIELD_INDENT && currentPackage !== null) {
      const [key, ...rest] = line.trim().split(':');
      if (key === 'version') {
        versions[currentPackage] = unquoted(rest.join(':').trim());
      }
    }
  }
  return versions;
};
