import type { PluginSyncDeps } from './sync';

/**
 * Everything the bundled Dart extractor needs to run: the SDK binaries, its
 * own directory, and where extracted APIs are cached.
 */
export interface ExtractorConfig {
  flutterBin: string;
  dartBin: string;
  dartSdkPath: string;
  extractorDir: string;
  cacheDir: string;
  runProcess: (command: string[], cwd: string) => Promise<number>;
  pathExists: (path: string) => Promise<boolean>;
  ensureDir: (path: string) => Promise<void>;
}

const PACKAGE_CONFIG = '.dart_tool/package_config.json';

/**
 * Runs the bundled Dart extractor against a package resolved in the user's
 * project, resolving the extractor's own dependencies on first use.
 */
export const createPluginExtractor = (
  config: ExtractorConfig,
): PluginSyncDeps['extractPlugin'] => {
  const {
    flutterBin,
    dartBin,
    dartSdkPath,
    extractorDir,
    cacheDir,
    runProcess,
    pathExists,
    ensureDir,
  } = config;

  return async (packageName, projectDir, outPath): Promise<number> => {
    await ensureDir(cacheDir);

    if (!(await pathExists(`${extractorDir}/${PACKAGE_CONFIG}`))) {
      const resolved = await runProcess(
        [flutterBin, 'pub', 'get'],
        extractorDir,
      );
      if (resolved !== 0) return resolved;
    }

    return runProcess(
      [
        dartBin,
        'run',
        'bin/extract_plugin.dart',
        '--package',
        packageName,
        '--project',
        projectDir,
        '--sdk-path',
        dartSdkPath,
        '--out',
        outPath,
      ],
      extractorDir,
    );
  };
};
