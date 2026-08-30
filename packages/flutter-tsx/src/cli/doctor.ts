import {
  manifestRequirements,
  parsePluginApi,
  type PluginApi,
} from '../plugins/api';
import { readPluginDependencies } from '../plugins/install';
import { projectApiDir } from '../plugins/sync';
import type { SdkManifest } from '../sdk/manifest';

/** One thing `fsx doctor` looked at, and what it found. */
export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DoctorDeps {
  readManifest: () => Promise<SdkManifest | null>;
  pinnedVersion: string;
  readFile: (path: string) => Promise<string | null>;
  pathExists: (path: string) => Promise<boolean>;
  out: (line: string) => void;
}

const ROOT_COMPONENT = 'src/App.tsx';
const INSTALL_HINT = 'run `fsx install`';
const IOS_PLIST = 'ios/Runner/Info.plist';
const IOS_CHECK = 'iOS usage descriptions';

export const formatCheck = (check: Check): string =>
  `[${check.ok ? '✓' : '✗'}] ${check.name} — ${check.detail}`;

const sdkCheck = async (deps: DoctorDeps): Promise<Check> => {
  const manifest = await deps.readManifest();
  if (manifest === null) {
    return {
      name: 'Flutter SDK',
      ok: false,
      detail: `not installed — ${INSTALL_HINT}`,
    };
  }
  if (manifest.flutterVersion !== deps.pinnedVersion) {
    return {
      name: 'Flutter SDK',
      ok: false,
      detail:
        `${manifest.flutterVersion} installed, ${deps.pinnedVersion} pinned — ` +
        INSTALL_HINT,
    };
  }
  return { name: 'Flutter SDK', ok: true, detail: manifest.flutterVersion };
};

interface Manifest {
  name: string;
  plugins: Record<string, string>;
}

const readProjectManifest = async (
  manifestPath: string,
  deps: DoctorDeps,
): Promise<Manifest | string> => {
  const contents = await deps.readFile(manifestPath);
  if (contents === null) {
    return `no package.json here — run \`fsx init\``;
  }
  let plugins: Record<string, string>;
  try {
    plugins = readPluginDependencies(contents, manifestPath);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  const parsed = JSON.parse(contents) as { name?: unknown };
  return {
    name: typeof parsed.name === 'string' ? parsed.name : '(unnamed)',
    plugins,
  };
};

/** Whether every declared plugin is installed and has its typings. */
const pluginsCheck = async (
  projectDir: string,
  manifest: Manifest | string,
  deps: DoctorDeps,
): Promise<Check> => {
  if (typeof manifest === 'string') {
    return {
      name: 'Plugins',
      ok: false,
      detail: 'cannot be checked without a package.json',
    };
  }
  const declared = Object.keys(manifest.plugins).sort();
  if (declared.length === 0) {
    return { name: 'Plugins', ok: true, detail: 'none declared' };
  }

  const installed = await deps.readFile(`${projectDir}/.fsx/plugins.json`);
  const recorded =
    installed === null ? {} : (JSON.parse(installed) as Record<string, string>);

  for (const name of declared) {
    if (recorded[name] !== manifest.plugins[name]) {
      return {
        name: 'Plugins',
        ok: false,
        detail: `${name} declared but not installed — ${INSTALL_HINT}`,
      };
    }
    if (!(await deps.pathExists(`${projectDir}/.fsx/types/${name}.d.ts`))) {
      return {
        name: 'Plugins',
        ok: false,
        detail: `${name} has no typings — ${INSTALL_HINT}`,
      };
    }
  }
  return {
    name: 'Plugins',
    ok: true,
    detail: `${declared.length} installed, in sync`,
  };
};

/**
 * The one platform duty a plugin brings that nothing else can discharge.
 *
 * Gradle merges a plugin's Android permissions on its own, and query schemes
 * apply only to an app that looks those URLs up. An iOS usage description is
 * different: the host app must carry the key, and its value is a purpose
 * string shown to the user and reviewed by Apple — so this reports the
 * missing keys and leaves the wording to whoever ships the app.
 */
const iosUsageCheck = async (
  projectDir: string,
  manifest: Manifest | string,
  deps: DoctorDeps,
): Promise<Check> => {
  const declared =
    typeof manifest === 'string' ? [] : Object.keys(manifest.plugins).sort();

  const apis: PluginApi[] = [];
  for (const name of declared) {
    const path = `${projectApiDir(projectDir)}/${name}.json`;
    const contents = await deps.readFile(path);
    // A plugin that was never installed has no extraction to read; the
    // plugins check above is the one that reports it.
    if (contents === null) continue;
    apis.push(parsePluginApi(JSON.parse(contents), path));
  }

  const needed = manifestRequirements(apis).ios.usageDescriptionKeys;
  if (needed.length === 0) {
    return { name: IOS_CHECK, ok: true, detail: 'no plugin needs one' };
  }

  const plist = await deps.readFile(`${projectDir}/${IOS_PLIST}`);
  if (plist === null) {
    return {
      name: IOS_CHECK,
      ok: true,
      detail: 'no iOS host app in this project',
    };
  }

  const missing = needed.filter((key) => !plist.includes(`<key>${key}</key>`));
  if (missing.length === 0) {
    return { name: IOS_CHECK, ok: true, detail: `${needed.length} declared` };
  }
  const plural = missing.length === 1;
  return {
    name: IOS_CHECK,
    ok: false,
    detail:
      `${missing.join(', ')} missing from ${IOS_PLIST} — ` +
      `add ${plural ? 'it' : 'them'} with your own purpose ` +
      (plural ? 'string' : 'strings'),
  };
};

/**
 * Reports what a project needs to build, and what to run when something is
 * missing. Exits non-zero when anything is wrong, so CI can gate on it.
 */
export const runDoctorCommand = async (
  projectDir: string,
  deps: DoctorDeps,
): Promise<number> => {
  const manifest = await readProjectManifest(
    `${projectDir}/package.json`,
    deps,
  );
  const hasRoot = await deps.pathExists(`${projectDir}/${ROOT_COMPONENT}`);

  const checks: Check[] = [
    await sdkCheck(deps),
    typeof manifest === 'string'
      ? { name: 'Project', ok: false, detail: manifest }
      : { name: 'Project', ok: true, detail: manifest.name },
    {
      name: 'Root component',
      ok: hasRoot,
      detail: hasRoot ? ROOT_COMPONENT : `${ROOT_COMPONENT} is missing`,
    },
    await pluginsCheck(projectDir, manifest, deps),
    await iosUsageCheck(projectDir, manifest, deps),
  ];

  for (const check of checks) {
    deps.out(formatCheck(check));
  }

  const failures = checks.filter((check) => !check.ok).length;
  deps.out(
    failures === 0
      ? 'No issues found.'
      : `${failures} issue${failures === 1 ? '' : 's'} found.`,
  );
  return failures === 0 ? 0 : 1;
};
