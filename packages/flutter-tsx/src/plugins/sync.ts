import { parsePluginApi } from './api';
import { emitPluginDeclaration } from './emit-types';
import { deriveHooks } from './hooks';
import {
  planPluginSync,
  type PluginConstraints,
  readPluginDependencies,
  resolvedVersions,
} from './install';
import { PLUGIN_OVERRIDES } from './overrides';

/**
 * Everything the sync touches outside itself, injected so the whole flow can
 * be driven without a Flutter SDK or a filesystem.
 */
export interface PluginSyncDeps {
  readFile: (path: string) => Promise<string | null>;
  writeFile: (path: string, contents: string) => Promise<void>;
  removeFile: (path: string) => Promise<void>;
  pathExists: (path: string) => Promise<boolean>;
  runFlutter: (args: string[], cwd: string) => Promise<number>;
  extractPlugin: (
    packageName: string,
    projectDir: string,
    outPath: string,
  ) => Promise<number>;
  /** Where extracted APIs are kept, keyed by package and resolved version. */
  cacheDir: string;
  out: (line: string) => void;
}

const STATE_FILE = '.fsx/plugins.json';
const TYPES_DIR = '.fsx/types';
const API_DIR = '.fsx/api';

/** Where the compiler looks for this project's extracted plugin APIs. */
export const projectApiDir = (projectDir: string): string =>
  `${projectDir}/${API_DIR}`;

const typesPath = (projectDir: string, packageName: string): string =>
  `${projectDir}/${TYPES_DIR}/${packageName}.d.ts`;

const readInstalled = async (
  projectDir: string,
  deps: PluginSyncDeps,
): Promise<PluginConstraints> => {
  const path = `${projectDir}/${STATE_FILE}`;
  const contents = await deps.readFile(path);
  if (contents === null) return {};
  return readPluginDependencies(
    JSON.stringify({ plugins: JSON.parse(contents) as unknown }),
    path,
  );
};

const pub = async (
  args: string[],
  projectDir: string,
  deps: PluginSyncDeps,
): Promise<void> => {
  const exitCode = await deps.runFlutter(args, projectDir);
  if (exitCode !== 0) {
    throw new Error(`\`flutter ${args.join(' ')}\` failed (exit ${exitCode}).`);
  }
};

const plural = (count: number): string => (count === 1 ? 'plugin' : 'plugins');

interface TypingsRequest {
  path: string;
  packageName: string;
  version: string;
  projectDir: string;
}

/** Resolves a plugin's API, extracting it once per package version. */
const apiFor = async (
  request: TypingsRequest,
  deps: PluginSyncDeps,
): Promise<ReturnType<typeof parsePluginApi>> => {
  const { packageName, version, projectDir } = request;
  const cachePath = `${deps.cacheDir}/${packageName}@${version}.json`;

  const extract = async (): Promise<string> => {
    const exitCode = await deps.extractPlugin(
      packageName,
      projectDir,
      cachePath,
    );
    if (exitCode !== 0) {
      throw new Error(
        `extracting the ${packageName} ${version} API failed (exit ${exitCode}).`,
      );
    }
    const written = await deps.readFile(cachePath);
    if (written === null) {
      throw new Error(`${cachePath} was not written by the extractor.`);
    }
    return written;
  };

  // The cache is keyed by package version, not by the extractor's — so an
  // extraction written by an older one can be missing what this reader needs.
  // Extracting again is cheap; failing the install over a stale cache is not.
  const cached = (await deps.pathExists(cachePath))
    ? await deps.readFile(cachePath)
    : null;
  let contents = cached ?? (await extract());
  let api = tryParsePluginApi(contents, cachePath);
  if (api === null) {
    contents = await extract();
    api = parsePluginApi(JSON.parse(contents), cachePath);
  }

  await deps.writeFile(
    `${projectApiDir(projectDir)}/${packageName}.json`,
    contents,
  );
  return api;
};

/** Null when the document is not one this version of the reader understands. */
const tryParsePluginApi = (
  contents: string,
  label: string,
): ReturnType<typeof parsePluginApi> | null => {
  try {
    return parsePluginApi(JSON.parse(contents), label);
  } catch {
    return null;
  }
};

/**
 * Brings a project's pub dependencies and `plugin:` typings in line with the
 * `"plugins"` map in its package.json.
 */
export const syncProjectPlugins = async (
  projectDir: string,
  deps: PluginSyncDeps,
): Promise<void> => {
  const manifestPath = `${projectDir}/package.json`;
  const manifestText = await deps.readFile(manifestPath);
  if (manifestText === null) {
    throw new Error(`${manifestPath} does not exist — run \`fsx init\` first.`);
  }

  const declared = readPluginDependencies(manifestText, manifestPath);
  const installed = await readInstalled(projectDir, deps);
  const { add, remove } = planPluginSync(declared, installed);

  if (remove.length > 0) {
    deps.out(
      `Removing ${remove.length} ${plural(remove.length)}: ${remove.join(', ')}`,
    );
    await pub(['pub', 'remove', ...remove], projectDir, deps);
    for (const packageName of remove) {
      await deps.removeFile(typesPath(projectDir, packageName));
    }
  }
  if (add.length > 0) {
    deps.out(`Adding ${add.length} ${plural(add.length)}: ${add.join(', ')}`);
    await pub(['pub', 'add', ...add], projectDir, deps);
  }

  let generated = 0;
  const names = Object.keys(declared).sort();
  if (names.length > 0) {
    const lockPath = `${projectDir}/pubspec.lock`;
    const lockText = await deps.readFile(lockPath);
    if (lockText === null) {
      throw new Error(
        `${lockPath} does not exist — \`flutter pub add\` did not write it.`,
      );
    }
    const versions = resolvedVersions(lockText);

    for (const packageName of names) {
      const version = versions[packageName];
      if (version === undefined) {
        throw new Error(
          `${packageName} is not in ${lockPath} — \`flutter pub add\` did not resolve it.`,
        );
      }
      const path = typesPath(projectDir, packageName);
      // Typings are rewritten for anything just added, and regenerated
      // whenever they are absent, so a deleted declaration is repaired rather
      // than assumed present.
      const stale =
        add.some((descriptor) => descriptor.startsWith(`${packageName}@`)) ||
        !(await deps.pathExists(path));
      if (stale) {
        await writeTypings({ path, packageName, version, projectDir }, deps);
        generated += 1;
      }
    }
  }

  if (add.length === 0 && remove.length === 0 && generated === 0) {
    deps.out('Plugins are up to date.');
  }

  // Only written when it changes, so a project with no plugins never grows a
  // .fsx directory it has no use for.
  if (add.length > 0 || remove.length > 0) {
    await deps.writeFile(
      `${projectDir}/${STATE_FILE}`,
      `${JSON.stringify(declared, null, 2)}\n`,
    );
  }
};

const writeTypings = async (
  request: TypingsRequest,
  deps: PluginSyncDeps,
): Promise<void> => {
  const { path, packageName, version } = request;
  const api = await apiFor(request, deps);
  const hooks = deriveHooks(api, PLUGIN_OVERRIDES[packageName]);
  await deps.writeFile(path, emitPluginDeclaration(api, hooks));
  deps.out(`Generated types for ${packageName} ${version}`);
};
