import { dartFileFor } from '../compiler/dart-names';
import type { TranspileInput } from '../compiler/transpile';

/** The root component every app is built around. */
export const ROOT_COMPONENT = 'App.tsx';

const SOURCE_DIR = 'src';
const OUTPUT_DIR = 'lib';
const ENTRY_FILE = 'main.dart';
const PLUGIN_API_DIR = '.fsx/api';

export interface BuildDeps {
  /** Component paths relative to `src`, e.g. `widgets/UserCard.tsx`. */
  findComponents: (sourceDir: string) => Promise<string[]>;
  readFile: (path: string) => Promise<string>;
  writeFile: (path: string, contents: string) => Promise<void>;
  transpile: (input: TranspileInput) => Promise<string>;
  /** Runs `dart format` over the generated output; resolves its exit code. */
  format: (outputDir: string) => Promise<number>;
}

export interface BuildConfig {
  name: string;
}

export { dartFileFor } from '../compiler/dart-names';

export interface EntryPoint {
  name: string;
  rootImport: string;
}

const dartString = (value: string): string =>
  `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** The generated `lib/main.dart` that hosts the root component. */
export const mainDart = ({ name, rootImport }: EntryPoint): string =>
  `import 'package:flutter/material.dart';

import '${rootImport}';

void main() {
  runApp(
    const MaterialApp(
      title: ${dartString(name)},
      home: Scaffold(body: SafeArea(child: App())),
    ),
  );
}
`;

/**
 * Compiles every component under `src` to Dart under `lib`, and writes the
 * entry point that runs the app.
 *
 * Returns the Dart files written, relative to `lib`.
 */
export const buildProject = async (
  projectDir: string,
  config: BuildConfig,
  deps: BuildDeps,
): Promise<string[]> => {
  const sourceDir = `${projectDir}/${SOURCE_DIR}`;
  const components = await deps.findComponents(sourceDir);

  if (!components.includes(ROOT_COMPONENT)) {
    throw new Error(
      `${sourceDir}/${ROOT_COMPONENT} does not exist — the app needs a root component.`,
    );
  }

  const written: string[] = [];
  for (const component of components) {
    const filePath = `${sourceDir}/${component}`;
    const dart = await deps.transpile({
      source: await deps.readFile(filePath),
      filePath,
      pluginApiDirs: [`${projectDir}/${PLUGIN_API_DIR}`],
    });
    const dartFile = dartFileFor(component);
    await deps.writeFile(`${projectDir}/${OUTPUT_DIR}/${dartFile}`, dart);
    written.push(dartFile);
  }

  await deps.writeFile(
    `${projectDir}/${OUTPUT_DIR}/${ENTRY_FILE}`,
    mainDart({ name: config.name, rootImport: dartFileFor(ROOT_COMPONENT) }),
  );

  // The Dart formatter is the authority on layout, so generated code is
  // canonical no matter which shapes the printer produced.
  const outputDir = `${projectDir}/${OUTPUT_DIR}`;
  const formatted = await deps.format(outputDir);
  if (formatted !== 0) {
    throw new Error(`formatting ${outputDir} failed (exit ${formatted}).`);
  }

  return written;
};
