# Flutter.tsx — CLAUDE.md

## Why This Project Exists

Paul has 20+ years of experience and has been burned by React Native + Xcode
instability. Flutter is stable cross-platform; Dart is verbose and unfamiliar to JS/TS
developers. Flutter.tsx bridges the gap: write TSX → compile to Dart → ship everywhere.
The goal: make Flutter feel like React — familiar component model, hooks, full
TypeScript guardrails — while generating idiomatic, production-quality Dart.

This repo is a **ground-up rewrite** toward 1.0. The v1 implementation (npm `0.x`)
shipped code that failed in real projects and is not trusted; nothing from it is reused
without re-earning its place through the gates below.

- Vision docs: `memory/chatgpt-vision.md`, `memory/chatgpt.txt` (local-only, git-ignored)
- v1 archive (read-only reference, including its git history): `~/Sources/flutter/`

## Non-Negotiable Working Rules

- **Never commit or publish without Paul's explicit permission.** No Claude attribution
  or co-author lines in commit messages, ever.
- **Verify, never assume.** No claim about an API, config, or behavior without reading
  the source, running the command, or a test proving it. This applies to conversation,
  code comments, and docs alike.
- **TDD.** The failing test is written before the implementation, every time.
- **100% test coverage**, enforced as a build-failing threshold (see Toolchain Facts).
- **Docs are factual at all times.** Documentation depending on a step's output is
  written after that step is built and verified. Every code snippet shown anywhere must
  be a passing test fixture — or be visibly marked as a not-yet-working target *before*
  the reader sees the code. Future work appears only as clearly-marked roadmap items.
- **DX is holy.** The developer writes idiomatic, React-like TSX (see the camera
  snippet in `README.md` — conformance fixture #1; every plugin hook and all Flutter
  TSX must feel exactly like it). When compiler simplicity and DX conflict, DX wins.
- **Generated Dart is held to senior hand-written standards** — `dart format`-stable,
  `dart analyze`-clean with recommended lints, idiomatic composition.
- **Latest dependencies.** Install via `bun add` (resolves latest), watch for updates;
  deviations are deliberate and documented (see TypeScript below).
- Senior-level code throughout: separation of concerns, DRY, no bloated files, no
  obvious comments, no single-character names, no shortcuts, no gaps, no deferring.

## Design Principles

- **The Flutter SDK source is the single source of truth.** Widget props, enums, slot
  semantics, and docs are extracted from the installed SDK via the Dart analyzer —
  never hand-maintained, never scraped from websites.
- **Type-directed compilation.** The compiler runs the real TypeScript type checker;
  inferred types flow into the emitted Dart. Unsupported constructs produce precise
  compile errors — never silently wrong output.
- **Dart is emitted from an AST, never from string templates.**
- **Verification before features.** Golden fixtures are gated by `dart format` +
  `dart analyze` against the real SDK; the e2e suite scaffolds and builds real Flutter
  projects. A feature exists when its fixture is green, not before.
- **Bun-native everywhere** — `bun test`, `Bun.file`, workspaces; no Node polyfills.

## Repository Layout (current reality)

```
package.json                  workspace marker only: ["packages/*", "e2e"] — the sole root tooling file
packages/flutter-tsx/         the engine (npm: flutter-tsx, CLI: fsx) — self-contained
packages/create-flutter-tsx/  the scaffolder (npm: create-flutter-tsx) — self-contained
e2e/                          cross-package suite; imports both packages via live workspace symlinks
memory/                       vision docs (git-ignored, local-only)
```

Each package carries its own strict `tsconfig.json`, `eslint.config.js` (type-checked
rules, `defineConfig`), `.prettierrc`, and `bunfig.toml`. Both packages are
`private: true` until the 1.0 publish (guardrail against accidental `npm publish`).
GitHub: `archan937/flutter.tsx` (monorepo); each package's `repository.directory`
points at its subfolder.

## Toolchain Facts (verified 2026-08-22, Bun 1.4.0)

- **TypeScript is pinned to `^6.0.3`, deliberately not 7.x**: `typescript@7` is the
  Go-native compiler and does not ship the JS compiler API (`ts.createProgram`) that
  the transpiler front end and typescript-eslint (peer range `<6.1.0`) require. 6.0.3
  is the latest release of the JS-API line. Re-evaluate when TS7's API stabilizes.
- **Bun enforces bunfig `coverageThreshold = 1.0` natively** (verified to fail the
  build on any gap) — v1's `check-coverage.ts` workaround is obsolete.
- **Cross-package linking uses Bun workspaces** (true symlinks, never stale). Verified
  alternatives are worse: `link:../path` fails to install; `file:../path` makes stale
  copies.

## Commands

```bash
bun install                        # once, at the repo root (installs all workspaces)
bun run --filter '*' quality      # quality gate across all workspaces, from the root

# per package (packages/*, e2e):
bun run quality                    # typecheck + format + lint + test with coverage
bun run typecheck | format | lint | test | test:coverage
```

## Rewrite Roadmap (only checked items exist)

- [x] 1. Monorepo skeleton with enforced quality gates
- [x] 2. This CLAUDE.md
- [x] 2b. Verbatim import of the v1 docs site → `docs/` (layout/styling/animations/logos
      preserved exactly; unpublished baseline — content regenerates from verified
      reality later; generator port lands with step 7, deploy with step 30)
- [ ] 3. SDK downloader — `fsx install` → `~/.fsx/flutter`, pinned version (TS)
- [ ] 4. SDK extractor — Dart analyzer over SDK source → `ref/api.json` (Dart)
- [ ] 5. `api.json` schema + validating loader (TS)
- [ ] 6. Slot-semantics derivation → `ref/derived/slots.json` (TS)
- [ ] 7. TS type generator → `src/generated/` (every widget prop typed); regenerate
      API reference after this
- [ ] 8. Runtime surface — jsx-runtime, hook declarations, `flutter-tsx/plugins`
- [ ] 9. Golden test runner (diff vs `expected.dart` + `dart format` + `dart analyze`);
      camera snippet checked in red as fixture #1
- [ ] 10. E2E harness — scaffold → install → transpile → `flutter build web`
- [ ] 11–21. The compiler: front end (TS checker) → IR → Dart AST → emitter, one
      feature per step, each ending in a green golden fixture; diagnostics with
      file/line + fix hints
- [ ] 22–24. Plugins: codegen data, `useCamera` end to end (fixture #1 fully green —
      the trust milestone), then one plugin at a time
- [ ] 25–28. `fsx` CLI (init/dev/build/doctor) + `create-flutter-tsx` scaffolder
- [ ] 29–31. CI pipeline, docs from fixtures + site deploy, 1.0 publish (Paul triggers)
