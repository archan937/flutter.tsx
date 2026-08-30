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
[cookbook](https://archan937.github.io/flutter.tsx/cookbook.html) for every fixture, as
written and as emitted.

## Getting started

```sh
npm create flutter-tsx@latest my-app
cd my-app

fsx install    # the pinned Flutter SDK, plus the plugins package.json declares
fsx dev        # compile, run, hot reload on save
```

## The CLI

| Command                           | What it does                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fsx install`                     | Downloads the pinned Flutter SDK to `~/.fsx`, syncs `pubspec.yaml` from the `"plugins"` map in package.json, generates `plugin:*` typings for the resolved versions |
| `fsx init <dir>`                  | Scaffolds a project and its host Flutter app                                                                                                                        |
| `fsx dev`                         | Compiles `src/**/*.tsx` → `lib/`, runs the app, hot reloads on save                                                                                                 |
| `fsx build [--target=<platform>]` | Release build for `web`, `ios`, `android`, `macos`, `windows` or `linux`                                                                                            |
| `fsx doctor`                      | Reports whether the SDK, project and plugins are ready, naming the fix for each problem                                                                             |

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

- [Guide](https://archan937.github.io/flutter.tsx/guide.md) — from scaffold to release build
- [Cookbook](https://archan937.github.io/flutter.tsx/cookbook.html) — every fixture, TSX beside Dart
- [API reference](https://archan937.github.io/flutter.tsx/api-reference.html) — every widget, prop and enum, generated from the SDK
- [Config mapping](https://archan937.github.io/flutter.tsx/config-mapping.md) — what fsx writes, and what it does not

## License

MIT © Paul Engel
