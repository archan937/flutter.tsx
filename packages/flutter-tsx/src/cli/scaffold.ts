import { FLUTTER_TSX_VERSION } from '../index';

export interface ScaffoldOptions {
  /** Dart package name for the app: lower_snake_case. */
  name: string;
  /** Reverse-DNS application id, e.g. `dev.fluttertsx.myapp`. */
  bundleId: string;
  /** flutter-tsx version the project depends on. */
  version: string;
}

export interface ScaffoldFile {
  path: string;
  contents: string;
}

const packageJson = (options: ScaffoldOptions): string => `{
  "name": "${options.name}",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "fsx dev",
    "build": "fsx build"
  },
  "dependencies": {
    "flutter-tsx": "^${options.version}"
  },
  "plugins": {}
}
`;

// `jsxImportSource` is what lets a component be written as plain TSX, and the
// strict flags are the guardrails the compiler relies on being true.
const tsconfigJson = (): string => `{
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
`;

// `satisfies` keeps the literal types while checking the shape, so the IDE
// completes every field and rejects an unknown one.
const configFile = (options: ScaffoldOptions): string =>
  `import type { AppConfig } from 'flutter-tsx';

export default {
  name: '${options.name}',
  bundleId: '${options.bundleId}',
  target: 'web',
} satisfies AppConfig;
`;

const starterComponent = (): string =>
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
`;

const gitignore = (): string => `.dart_tool/
.fsx/
build/
node_modules/
`;

/**
 * Every file a new project starts with, sorted by path so the scaffold is
 * deterministic. Pure: the command writes what this returns.
 */
export const scaffoldFiles = (options: ScaffoldOptions): ScaffoldFile[] =>
  [
    { path: '.gitignore', contents: gitignore() },
    { path: 'fsx.config.ts', contents: configFile(options) },
    { path: 'package.json', contents: packageJson(options) },
    { path: 'src/App.tsx', contents: starterComponent() },
    { path: 'tsconfig.json', contents: tsconfigJson() },
  ].sort((first, second) => first.path.localeCompare(second.path));

export const DEFAULT_SCAFFOLD_VERSION = FLUTTER_TSX_VERSION;
