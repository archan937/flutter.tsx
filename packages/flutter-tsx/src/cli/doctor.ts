import { readPluginDependencies } from '../plugins/install';
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
