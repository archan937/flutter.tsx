import { describe, expect, test } from 'bun:test';

import { scaffoldFiles, type ScaffoldOptions } from '@src/cli/scaffold';
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
  "include": ["src", "fsx.config.ts"]
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

  test('the starter component compiles as it stands', () => {
    expect(fileNamed('src/App.tsx')).toBe(
      `import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const App = () => {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <Column>
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
};
`,
    );
  });

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
