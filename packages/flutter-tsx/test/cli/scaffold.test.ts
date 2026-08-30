import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { scaffoldFiles, type ScaffoldOptions } from '@src/cli/scaffold';
import { transpileComponent } from '@src/compiler/transpile';
import { FLUTTER_TSX_VERSION } from '@src/index';

const options: ScaffoldOptions = {
  name: 'my_app',
  bundleId: 'dev.fluttertsx.myapp',
  version: FLUTTER_TSX_VERSION,
};

const fileNamed = (name: string): string => {
  const file = scaffoldFiles(options).find((entry) => entry.path === name);
  if (file === undefined) {
    throw new Error(`no scaffolded file named ${name}`);
  }
  return file.contents;
};

describe('scaffoldFiles', () => {
  test('scaffolds exactly the files a project needs', () => {
    expect(scaffoldFiles(options).map((file) => file.path)).toEqual([
      '.gitignore',
      'fsx.config.ts',
      'package.json',
      'src/App.tsx',
      'src/components/Greeting.tsx',
      'src/helpers/format.tsx',
      'tsconfig.json',
    ]);
  });

  test('package.json declares the dependency and an empty plugin map', () => {
    expect(fileNamed('package.json')).toBe(
      `{
  "name": "my_app",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "fsx dev",
    "build": "fsx build"
  },
  "dependencies": {
    "flutter-tsx": "^${FLUTTER_TSX_VERSION}"
  },
  "plugins": {}
}
`,
    );
  });

  test('tsconfig points JSX at flutter-tsx and stays strict', () => {
    expect(fileNamed('tsconfig.json')).toBe(
      `{
  "compilerOptions": {
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "flutter-tsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": []
  },
  "include": ["src", "fsx.config.ts", ".fsx/types"]
}
`,
    );
  });

  test('the config is typed, so the IDE guides every field', () => {
    expect(fileNamed('fsx.config.ts')).toBe(
      `import type { AppConfig } from 'flutter-tsx';

export default {
  name: 'my_app',
  bundleId: 'dev.fluttertsx.myapp',
  target: 'web',
} satisfies AppConfig;
`,
    );
  });

  test('the starter app compiles, every file of it', async () => {
    // The scaffold is the recommended layout, so it has to be a layout that
    // works: App renders a component from components/, which calls a helper
    // from helpers/, and each file becomes the Dart file beside it.
    const root = await mkdtemp(join(tmpdir(), 'fsx-scaffold-'));
    for (const file of scaffoldFiles(options)) {
      await Bun.write(join(root, file.path), file.contents);
    }

    const dartFor = async (relative: string): Promise<string> => {
      const filePath = join(root, 'src', relative);
      return transpileComponent({
        source: await Bun.file(filePath).text(),
        filePath,
      });
    };

    expect(await dartFor('App.tsx')).toContain(
      "import 'components/greeting.dart';",
    );
    expect(await dartFor('components/Greeting.tsx')).toContain(
      "import '../helpers/format.dart';",
    );
    expect(await dartFor('helpers/format.tsx')).toContain(
      'String shout(String value) => value.trim().toUpperCase();',
    );

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('generated Dart and build output stay out of version control', () => {
    expect(fileNamed('.gitignore')).toBe(
      `.dart_tool/
.fsx/
build/
node_modules/
`,
    );
  });
});
