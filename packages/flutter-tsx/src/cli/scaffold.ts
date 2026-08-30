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

/**
 * The starter app is the recommended layout, working.
 *
 * A project needs somewhere to put a second file before it has one, and a
 * developer should not have to guess where. `App.tsx` composes a component
 * from `components/` which calls a helper from `helpers/`, so every
 * directory the guide recommends is already there and already compiling.
 */
const starterComponent = (): string =>
  `import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

import { Greeting } from './components/Greeting';

export const App = () => {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <Column mainAxisAlignment="center">
      <Greeting name="world" />
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
};
`;

const starterGreeting = (): string =>
  `import { Text } from 'flutter-tsx';

import { shout } from '../helpers/format';

/** A component of your own: used as \`<Greeting name="world" />\`. */
export const Greeting = ({ name }: { name: string }) => (
  <Text>Hello, {shout(name)}!</Text>
);
`;

const starterHelper = (): string =>
  `/** A plain function: compiles to a top-level Dart function of the same name. */
export const shout = (value: string): string => value.trim().toUpperCase();
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
    { path: 'src/components/Greeting.tsx', contents: starterGreeting() },
    { path: 'src/helpers/format.tsx', contents: starterHelper() },
    { path: 'tsconfig.json', contents: tsconfigJson() },
  ].sort((first, second) => first.path.localeCompare(second.path));

export const DEFAULT_SCAFFOLD_VERSION = FLUTTER_TSX_VERSION;
