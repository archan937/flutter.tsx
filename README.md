# Flutter.tsx

**Write Flutter apps in TypeScript + JSX with full IDE autocomplete — idiomatic TSX transpiles to idiomatic Dart.**

React developers get the component model, hooks, and TypeScript guardrails they already
know. Flutter provides the stable, truly cross-platform runtime. Flutter.tsx bridges the
two: you write TSX, the compiler emits the Dart a senior Flutter developer would have
written by hand.

> 🚧 **Not on npm yet.** Flutter.tsx is being rewritten from the ground up (see
> [Status](#status)); the `0.x` releases on npm are the legacy implementation. The
> compiler and the whole `fsx` CLI work today from a clone — what remains before 1.0
> is CI, the docs site, and the publish itself. The snippet below **compiles today**:
> the test suite transpiles this exact file, verifies the emitted Dart byte-for-byte
> against a hand-certified golden, and builds it as a real Flutter web app on every run.

```tsx
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'plugin:camera';

export const CameraScreen = () => {
  const cam = useCamera();
  const [taken, setTaken] = useState(false);

  const takePhoto = async () => {
    await cam?.takePicture();
    setTaken(true);
  };

  return (
    <Column>
      {taken && <Text>Photo saved!</Text>}
      <ElevatedButton onClick={takePhoto}>Take Photo</ElevatedButton>
    </Column>
  );
};
```

This is **conformance fixture #1** of the compiler test suite — the trust milestone.
Native camera access, React state, an async event handler, and conditional rendering
in twenty lines: every Flutter.tsx API is held to this level of ergonomics. The suite
transpiles this file, `dart analyze`s the output, and builds it as a real Flutter app
on every run; 1.0 ships only once the same proof runs in CI plus the real-device gate.

## Getting started

Neither package is on npm yet, so the commands below are what 1.0 will ship. Today the
same project comes from a clone:

```bash
git clone https://github.com/archan937/flutter.tsx
cd flutter.tsx && bun install
bun packages/flutter-tsx/bin/fsx.ts init ~/my-app
```

```bash
npm create flutter-tsx@latest my-app   # or: bun create flutter-tsx my-app
cd my-app

fsx install    # the pinned Flutter SDK, plus the plugins package.json declares
fsx dev        # compile, run, and hot reload on every save
```

Then write components under `src/`, starting with `src/App.tsx`. The compiler writes
Dart to `lib/`, which nothing needs to edit by hand.

### Or start from a finished app

`--template` scaffolds a complete app instead of the starter, with the pub packages it
needs already installed:

```bash
fsx init my-app --template=web       # album browser: routes, a store, models, module data
fsx init my-app --template=mobile    # field notes: tabs, a live camera preview, the keychain
fsx init my-app --template=desktop   # service console: master–detail, live build info, links
fsx init my-app --template=tray      # menu-bar companion: tray events, a live connectivity stream
```

Each one is committed under [`examples/`](examples) so you can read it first, and each is
transpiled, `flutter analyze`d and **built for its own platform** on every run of the
end-to-end suite — the web app for web, the two desktop apps for macOS, the mobile app
for iOS. `--target=<platform>` builds any of them somewhere else:
`fsx init my-app --template=mobile --target=web`.

| Command | What it does |
| --- | --- |
| `fsx install` | Downloads the pinned Flutter SDK to `~/.fsx`, syncs `pubspec.yaml` from the `"plugins"` map in package.json, and generates `plugin:*` typings for the resolved versions |
| `fsx init <dir> [--template=<name>] [--target=<platform>]` | Scaffolds a project and its host Flutter app. `--template` starts from one of the four example apps (`web`, `mobile`, `desktop`, `tray`) and installs the pub packages it uses; `--target` picks the platform to create it for |
| `fsx dev` | Compiles `src/**/*.tsx` → `lib/`, runs the app, hot reloads on save |
| `fsx build [--target=<platform>] [--no-codesign]` | Release build for `web`, `ios`, `android`, `macos`, `windows` or `linux`; a platform the project has never built for is set up on the way. `--no-codesign` builds the unsigned iOS app, for a machine with no Apple developer account |
| `fsx doctor` | Reports whether the SDK, project and plugins are ready, and which iOS usage descriptions a declared plugin still needs — naming the fix for each, and exiting non-zero so CI can gate on it |

Plugins are declared the way npm dependencies are, and installed by the same command:

```jsonc
// package.json
{
  "plugins": { "camera": "^0.11.0", "url_launcher": "^6.3.0" }
}
```

`fsx install` then resolves them with pub, extracts each plugin's real API from the
resolved source, and writes the `plugin:<name>` typings your editor completes against.

## Why

Cross-platform development from a JS/TS background tends to offer a painful trade:
React Native brings the familiar model but a fragile native toolchain; Flutter brings
stability and first-class tooling but requires writing verbose, unfamiliar Dart.
Flutter.tsx removes the trade — the developer experience of React, the runtime and
ecosystem of Flutter.

## How it works

```
Flutter SDK source ──▶ Dart analyzer extractor ──▶ api.json (typed API model)
                                                        │
                        ┌───────────────────────────────┤
                        ▼                               ▼
              generated TypeScript types      slot/codegen metadata
              (every widget prop typed)               │
                        │                             │
   your .tsx ──▶ TypeScript type checker ──▶ Flutter-semantic IR ──▶ Dart AST ──▶ idiomatic Dart
```

The principles behind that pipeline:

- **The Flutter SDK source is the single source of truth.** Widget props, enums, slot
  semantics, and documentation are extracted from the installed SDK with the Dart
  analyzer — never hand-maintained, never scraped from docs, never allowed to drift
  from the Flutter version your app actually compiles against.
- **Type-directed compilation.** The compiler runs the real TypeScript type checker, so
  inferred types (`useState<User[]>` → `List<User>`) flow into the emitted Dart, and
  mistakes are precise compile-time errors — never silently wrong output.
- **Dart is emitted from an AST, never from string templates.** Malformed or misplaced
  code is structurally impossible.
- **Generated Dart is held to hand-written standards.** Every golden fixture must be
  `dart format`-stable and pass `dart analyze` with recommended lints, and the e2e suite
  builds fixtures as real Flutter projects with the real toolchain.

## Packages

| Package                                             | Description                                                                 |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| [`flutter-tsx`](packages/flutter-tsx)               | The engine: TSX→Dart compiler, typed Flutter API, plugin hooks, `fsx` CLI    |
| [`create-flutter-tsx`](packages/create-flutter-tsx) | Project scaffolder — `bun create flutter-tsx` / `npm create flutter-tsx`     |

## Status

Flutter.tsx is being **rewritten from the ground up** for its 1.0 release. The `0.x`
versions on npm are the legacy implementation and should not be used. The rewrite is
built test-first behind hard gates — 100% test coverage, golden fixtures verified by
`dart analyze`, and an e2e suite that scaffolds and builds real Flutter projects — and
1.0 ships only when conformance fixture #1 above runs end to end.

Rewrite progress:

- [x] Monorepo skeleton with enforced quality gates
- [x] SDK extractor (Dart analyzer → `api.json`, byte-deterministic)
- [x] Generated TypeScript API (every widget prop typed, value forms included)
- [x] Golden + e2e verification harness (fixtures build as real Flutter web apps)
- [x] The compiler: TSX → IR → Dart AST → idiomatic Dart — stateless & stateful
      components, typed props & composition, `useState`/`useEffect`, handlers,
      conditionals, list rendering, fragments (8 traits proven end to end)
- [x] Plugin hooks: on-demand extraction from the installed plugin's source, derived
      `useX` lifecycle hooks, generated `plugin:*` typings — every plugin breed proven,
      and any pub package can be installed and typed per project
- [x] The rest of the input language: control flow (`if`/`switch`/`for…of`/`while`/
      `try`), list pipelines (`filter`→`where`, `reduce`→`fold`), helper functions,
      enums, tuples, generics, multi-file imports, and the TSX Strict Mode error codes
      for everything Dart cannot express
- [x] High-level abstractions: `useAsync`/`useStream` → `FutureBuilder`/`StreamBuilder`,
      `createStore`/`useStore`, routing, modals, tabs, animation, gestures, typed JSON
- [x] `fsx` CLI (`install` · `init` · `dev` · `build` · `doctor`) and the scaffolder,
      building for web, iOS, Android, macOS, Windows and Linux — web and macOS are
      built end to end on every CI run
- [x] CI pipeline (three jobs; the macOS one builds real Flutter apps) and the docs site
- [ ] 1.0 on npm

## Repository layout

```
packages/flutter-tsx/         the engine (npm: flutter-tsx)
packages/flutter-tsx/templates/  the four apps `fsx init --template` writes
packages/create-flutter-tsx/  the scaffolder (npm: create-flutter-tsx)
examples/                     those four apps as scaffolded, generated by
                              `bun run examples` and checked byte-for-byte
e2e/                          end-to-end suite: scaffolds real projects, builds them
                              with the actual Flutter toolchain
```

Each package is self-contained; the workspace root only links them together.

## Development

Requires [Bun](https://bun.sh) (latest).

```bash
bun install                   # once, at the repo root

cd packages/flutter-tsx
bun run quality               # typecheck + format + lint + tests with enforced 100% coverage
```

Every package exposes the same scripts: `typecheck`, `format`, `lint`, `test`,
`test:coverage`, and `quality`. The discipline of this codebase: every documented
snippet is a test fixture, and nothing is claimed that a test does not prove.

## Contact

For support, remarks, and requests: [pm_engel@icloud.com](mailto:pm_engel@icloud.com)

## License

Copyright (c) 2026 Paul Engel, released under the [MIT License](LICENSE)

http://github.com/archan937 — [pm_engel@icloud.com](mailto:pm_engel@icloud.com) (see also: https://github.com/archan937/dust)
