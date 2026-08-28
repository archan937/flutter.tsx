import { watch } from 'node:fs';

import { buildProject } from '../build/project';
import { transpileComponent } from '../compiler/transpile';
import type { AppConfig, AppTarget } from '../runtime/config';
import { pathExists, readTextFile, writeTextFile } from '../sdk/io';

const CONFIG_FILE = 'fsx.config.ts';
const SOURCE_DIR = 'src';
const COMPONENT_GLOB = '**/*.tsx';

const DEVICES: Record<AppTarget, string> = {
  web: 'chrome',
  ios: 'ios',
  android: 'android',
};

const TARGETS = Object.keys(DEVICES) as AppTarget[];

/** The device `flutter run` targets for an app's configured platform. */
export const deviceFor = (target: AppTarget): string => DEVICES[target];

const isTarget = (value: unknown): value is AppTarget =>
  typeof value === 'string' && TARGETS.includes(value as AppTarget);

/** Reads and validates a project's `fsx.config.ts`. */
export const loadAppConfig = async (projectDir: string): Promise<AppConfig> => {
  const configPath = `${projectDir}/${CONFIG_FILE}`;
  if (!(await pathExists(configPath))) {
    throw new Error(`${configPath} does not exist — run \`fsx init\` first.`);
  }

  const module = (await import(configPath)) as { default?: unknown };
  const config = module.default;
  if (typeof config !== 'object' || config === null) {
    throw new Error(
      `${configPath} must export an app config as its default export.`,
    );
  }

  const { name, bundleId, target } = config as Record<string, unknown>;
  if (typeof name !== 'string') {
    throw new Error(`${configPath}: name must be a string.`);
  }
  if (typeof bundleId !== 'string') {
    throw new Error(`${configPath}: bundleId must be a string.`);
  }
  if (!isTarget(target)) {
    throw new Error(
      `${configPath}: target must be one of ${TARGETS.join(', ')}.`,
    );
  }
  return { name, bundleId, target };
};

/** A running `flutter run`, which fsx drives for hot reload. */
export interface FlutterSession {
  reload: () => void;
  stop: () => void;
  exited: Promise<number>;
}

export interface DevDeps {
  loadConfig: (projectDir: string) => Promise<AppConfig>;
  build: (projectDir: string, config: AppConfig) => Promise<string[]>;
  startFlutter: (args: string[], cwd: string) => FlutterSession;
  watch: (dir: string, onChange: (path: string) => void) => () => void;
  out: (line: string) => void;
}

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Compiles the project, runs it, and keeps it in sync: every saved component
 * is recompiled and hot reloaded. A compile error is reported and the app
 * keeps running, so a typo never ends the session.
 */
export const runDevCommand = async (
  projectDir: string,
  deps: DevDeps,
): Promise<number> => {
  const config = await deps.loadConfig(projectDir);
  deps.out(`Building ${config.name}…`);
  await deps.build(projectDir, config);

  const device = deviceFor(config.target);
  const session = deps.startFlutter(['run', '-d', device], projectDir);
  deps.out(`Running on ${device} — edit ${SOURCE_DIR}/ to hot reload.`);

  const stopWatching = deps.watch(
    `${projectDir}/${SOURCE_DIR}`,
    (path: string): void => {
      void deps
        .build(projectDir, config)
        .then(() => {
          deps.out(`Rebuilt ${path.replace(`${projectDir}/`, '')}`);
          session.reload();
        })
        .catch((error: unknown) => {
          deps.out(messageOf(error));
        });
    },
  );

  try {
    return await session.exited;
  } finally {
    stopWatching();
  }
};

export const defaultDevDeps = (flutterBin: string): DevDeps => ({
  loadConfig: loadAppConfig,
  build: (projectDir, config) =>
    buildProject(projectDir, config, {
      findComponents: async (sourceDir) => {
        const found: string[] = [];
        for await (const file of new Bun.Glob(COMPONENT_GLOB).scan({
          cwd: sourceDir,
        })) {
          found.push(file);
        }
        return found.sort();
      },
      readFile: async (path) => (await readTextFile(path)) ?? '',
      writeFile: writeTextFile,
      transpile: transpileComponent,
    }),
  startFlutter: (args, cwd): FlutterSession => {
    const child = Bun.spawn([flutterBin, ...args], {
      cwd,
      stdin: 'pipe',
      stdout: 'inherit',
      stderr: 'inherit',
    });
    return {
      // `flutter run` hot reloads on `r`, hot restarts on `R`, quits on `q`.
      reload: (): void => {
        void child.stdin.write('r');
        void child.stdin.flush();
      },
      stop: (): void => {
        child.kill();
      },
      exited: child.exited,
    };
  },
  watch: (dir, onChange) => {
    const watcher = watch(dir, { recursive: true }, (_event, filename) => {
      if (filename?.endsWith('.tsx') === true) {
        onChange(`${dir}/${filename}`);
      }
    });
    return (): void => {
      watcher.close();
    };
  },
  out: (line: string): void => {
    process.stdout.write(`${line}\n`);
  },
});
