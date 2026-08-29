import type { AppConfig, AppTarget } from '../runtime/config';

/** What `flutter build` is called for each target. */
const SUBCOMMANDS: Record<AppTarget, string> = {
  web: 'web',
  ios: 'ipa',
  android: 'appbundle',
  macos: 'macos',
  windows: 'windows',
  linux: 'linux',
};

/** Where each target leaves its build, relative to the project. */
const ARTIFACTS: Record<AppTarget, string> = {
  web: 'build/web',
  ios: 'build/ios/ipa',
  android: 'build/app/outputs/bundle/release/app-release.aab',
  macos: 'build/macos/Build/Products/Release',
  windows: 'build/windows/x64/runner/Release',
  linux: 'build/linux/x64/release/bundle',
};

/** Desktop platforms are opt-in in the SDK, and each has its own switch. */
const DESKTOP_SWITCHES: Partial<Record<AppTarget, string>> = {
  macos: '--enable-macos-desktop',
  windows: '--enable-windows-desktop',
  linux: '--enable-linux-desktop',
};

/**
 * Platforms with a directory in the project. Web builds from the sources
 * `flutter create` already wrote, so it needs none.
 */
const SCAFFOLDED: Partial<Record<AppTarget, string>> = {
  ios: 'ios',
  android: 'android',
  macos: 'macos',
  windows: 'windows',
  linux: 'linux',
};

const TARGETS = Object.keys(SUBCOMMANDS) as AppTarget[];

const TARGET_FLAG = '--target=';

export const buildSubcommand = (target: AppTarget): string =>
  SUBCOMMANDS[target];

export const artifactPath = (target: AppTarget): string => ARTIFACTS[target];

const isTarget = (value: string): value is AppTarget =>
  TARGETS.includes(value as AppTarget);

/** The `--target=<platform>` override, or null to use the project's own. */
export const parseTargetFlag = (args: string[]): AppTarget | null => {
  let chosen: AppTarget | null = null;
  for (const argument of args) {
    if (!argument.startsWith(TARGET_FLAG)) {
      throw new Error(
        `unexpected argument \`${argument}\`: fsx build takes --target=<platform>.`,
      );
    }
    const value = argument.slice(TARGET_FLAG.length);
    if (!isTarget(value)) {
      throw new Error(
        `unknown target \`${value}\`: one of ${TARGETS.join(', ')}.`,
      );
    }
    chosen = value;
  }
  return chosen;
};

export interface BuildDeps {
  loadConfig: (projectDir: string) => Promise<AppConfig>;
  build: (projectDir: string, config: AppConfig) => Promise<string[]>;
  runFlutter: (args: string[], cwd: string) => Promise<number>;
  pathExists: (path: string) => Promise<boolean>;
  out: (line: string) => void;
}

const run = async (
  args: string[],
  projectDir: string,
  deps: BuildDeps,
): Promise<void> => {
  const exitCode = await deps.runFlutter(args, projectDir);
  if (exitCode !== 0) {
    throw new Error(`\`flutter ${args.join(' ')}\` failed (exit ${exitCode}).`);
  }
};

/**
 * Compiles the project and builds it for release. A platform the project has
 * never built for is scaffolded first, so a web-only app can ship for macOS
 * without anyone editing native folders by hand.
 */
export const runBuildCommand = async (
  projectDir: string,
  args: string[],
  deps: BuildDeps,
): Promise<void> => {
  const override = parseTargetFlag(args);
  const configured = await deps.loadConfig(projectDir);
  const config =
    override === null ? configured : { ...configured, target: override };

  deps.out(`Building ${config.name} for ${config.target}…`);
  await deps.build(projectDir, config);

  const desktopSwitch = DESKTOP_SWITCHES[config.target];
  if (desktopSwitch !== undefined) {
    await run(['config', desktopSwitch], projectDir, deps);
  }

  const platformDir = SCAFFOLDED[config.target];
  if (
    platformDir !== undefined &&
    !(await deps.pathExists(`${projectDir}/${platformDir}`))
  ) {
    await run(['create', '--platforms', platformDir, '.'], projectDir, deps);
  }

  await run(
    ['build', buildSubcommand(config.target), '--release'],
    projectDir,
    deps,
  );
  deps.out(`Built ${artifactPath(config.target)}`);
};
