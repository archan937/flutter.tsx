# Flutter.tsx

**Write Flutter apps in TypeScript + JSX with full IDE autocomplete — idiomatic TSX transpiles to idiomatic Dart.**

React developers get the component model, hooks, and TypeScript guardrails they already
know. Flutter provides the stable, truly cross-platform runtime. Flutter.tsx bridges the
two: you write TSX, the compiler emits the Dart a senior Flutter developer would have
written by hand.

> 🚧 **Not usable yet.** Flutter.tsx is being rewritten from the ground up (see
> [Status](#status)); the snippet below is the rewrite's target, not a working example.

```tsx
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { useCamera } from 'flutter-tsx/plugins';

export const CameraScreen = () => {
  const cam = useCamera();
  const [taken, setTaken] = useState(false);

  const takePhoto = async () => {
    await cam.takePicture();
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

This is **conformance fixture #1** of the compiler test suite. Native camera access,
React state, an async event handler, and conditional rendering in twenty lines: every
Flutter.tsx API is held to this level of ergonomics, and 1.0 ships only when CI
transpiles this file, `dart analyze`s the output, and builds it as a real Flutter app.

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
- [ ] SDK extractor (Dart analyzer → `api.json`)
- [ ] Generated TypeScript API (every widget prop typed)
- [ ] Golden + e2e verification harness
- [ ] The compiler: TSX → IR → Dart AST → idiomatic Dart
- [ ] Plugin hooks (`useCamera` first)
- [ ] `fsx` CLI (`install` · `init` · `dev` · `build` · `doctor`) and scaffolder
- [ ] 1.0 on npm

## Repository layout

```
packages/flutter-tsx/         the engine (npm: flutter-tsx)
packages/create-flutter-tsx/  the scaffolder (npm: create-flutter-tsx)
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

## License

[MIT](LICENSE)
