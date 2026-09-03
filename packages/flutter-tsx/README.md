# flutter-tsx

**Write Flutter apps in TypeScript + JSX. The compiler emits the Dart a senior Flutter
developer would have written by hand.**

This package is the engine and the `fsx` CLI: the TSX→Dart compiler, the typed Flutter
API generated from the SDK you compile against, and the plugin pipeline that types any
pub package for your project.

```tsx
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';

export const Counter = () => {
  const [count, setCount] = useState(0);

  const increment = () => {
    setCount(count + 1);
  };

  return (
    <Column mainAxisAlignment="center">
      <Text>Count: {count}</Text>
      <ElevatedButton onClick={increment}>Increment</ElevatedButton>
    </Column>
  );
};
```

That is a conformance fixture: the test suite asserts its emitted Dart byte-for-byte,
`dart format` certifies the layout, `flutter analyze` certifies it compiles, and the e2e
suite builds it as a real Flutter app on every run. See the
[cookbook](../../docs/cookbook.html) for every fixture, as written and as emitted.

## Getting started

> **Not on npm yet.** The `0.x` releases under this name are the previous
> implementation and should not be used. Until 1.0, run it from a clone.

```sh
git clone https://github.com/archan937/flutter.tsx
cd flutter.tsx && bun install
bun packages/flutter-tsx/bin/fsx.ts init ~/my-app

cd ~/my-app && bun install
fsx install    # the pinned Flutter SDK, plus the plugins package.json declares
fsx dev        # compile, run, hot reload on save
```

## The CLI

| Command                                           | What it does                                                                                                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fsx install`                                     | Downloads the pinned Flutter SDK to `~/.fsx`, syncs `pubspec.yaml` from the `"plugins"` map in package.json, generates `plugin:*` typings for the resolved versions |
| `fsx init <dir>`                                  | Scaffolds a project and its host Flutter app                                                                                                                        |
| `fsx dev`                                         | Compiles `src/**/*.tsx` → `lib/`, runs the app, hot reloads on save                                                                                                 |
| `fsx build [--target=<platform>] [--no-codesign]` | Release build for `web`, `ios`, `android`, `macos`, `windows` or `linux`; `--no-codesign` builds the unsigned iOS app                                               |
| `fsx doctor`                                      | Reports whether the SDK, project and plugins are ready, naming the fix for each problem                                                                             |

## Plugins

Declare them like npm dependencies; `fsx install` does the rest:

```jsonc
{
  "plugins": { "camera": "^0.11.0", "url_launcher": "^6.3.0" },
}
```

The API each plugin exposes is extracted from the resolved source with the Dart analyzer
— not hand-maintained — so the typings your editor completes against are the plugin you
actually depend on. Plugins whose lifecycle needs owning get a hook (`useCamera()`,
`useLocation()`, …) that acquires on mount and disposes on unmount.

## Documentation

The site is published once 1.0 ships; until then the pages live in the repository.

- [Guide](../../docs/guide.md) — from scaffold to release build
- [Cookbook](../../docs/cookbook.html) — every fixture, TSX beside Dart
- [API reference](../../docs/api-reference.html) — every widget, prop and enum,
  generated from the SDK, each widget with an example that compiles: **539 of 539** are
  typechecked against this package, transpiled to Dart and `flutter analyze`d on every run
- [Config mapping](../../docs/config-mapping.md) — what fsx writes, and what it does not

## License

MIT © Paul Engel
