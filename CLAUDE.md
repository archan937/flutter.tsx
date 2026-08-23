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
- **Bun tracks un-awaited `expect().rejects` assertions** (verified: a slow rejection
  with a wrong message still fails the test) — so no `await` on `rejects` chains; the
  typed-`void` signature is honest.

## Code Conventions

- **Path aliases, never parent-relative imports**: `@src/*`, `@test/*`, `@scripts/*`
  (declared in each package's tsconfig `paths`; Bun resolves them natively).
  Same-directory `./sibling` imports are fine; `../..` traversals are not.
- **Exact full-block assertions only — TS and Dart alike.** Never partial
  `contains`/`toContain` checks against output: assert the complete expected value
  (full string, full list, full JSON document — formatting both sides with the same
  formatter when needed). Expected values from third-party sources (Flutter SDK docs,
  signatures) are probed from reality first, then pinned exactly. Where output embeds
  genuinely third-party payloads (tar stderr) the owned structure is asserted with an
  anchored full-match regex.
- Effective Dart throughout the extractor: snake_case files, one concern per file
  under `lib/src/`, thin `bin/`, no 1–2-character names, comments only for
  constraints code cannot express.
- **No raw control bytes in source** — ANSI sequences are written as explicit escapes
  (`\u001B[2K`), and emitted only when stdout is a TTY.
- Effect-style deps are injected (see `InstallDeps`): orchestrators stay pure and fully
  unit-testable; the real I/O lives in one module (`src/sdk/io.ts`) tested against a
  local `Bun.serve` — unit tests never touch the network.

## Commands

```bash
bun install                        # once, at the repo root (installs all workspaces)
bun run --filter '*' quality      # quality gate across all workspaces, from the root

# per package (packages/*, e2e):
bun run quality                    # typecheck + format + lint + test with coverage
bun run typecheck | format | lint | test | test:coverage

# in packages/flutter-tsx:
bun bin/fsx.ts install             # download pinned Flutter SDK → ~/.fsx/flutter
bun run extract                    # SDK source → ref/api.json (runs flutter
                                   # update-packages first when needed)
bun run quality:extractor          # dart format + analyze + tests + 100% coverage gate
```

## Rewrite Roadmap (only checked items exist)

- [x] 1. Monorepo skeleton with enforced quality gates
- [x] 2. This CLAUDE.md
- [x] 2b. Verbatim import of the v1 docs site → `docs/` (layout/styling/animations/logos
      preserved exactly; unpublished baseline — content regenerates from verified
      reality later; generator port lands with step 7, deploy with step 30)
- [x] 3. SDK downloader — `fsx install` → `~/.fsx/flutter`, pinned Flutter 3.47.1,
      sha256-verified, idempotent via `~/.fsx/sdk-manifest.json` (TS; proven by a real
      2.1 GB install + `flutter --version`). Automated e2e in `e2e/test/install.test.ts`:
      runs the real CLI as a subprocess against a local release server
      (`FSX_RELEASES_URL` override) — install, exact CLI output, manifest, idempotent
      rerun, tampered-checksum rejection; plus an opt-in real-network variant
      (`FSX_E2E_REAL=1`) for pre-release runs.
- [x] 4. SDK extractor — Dart analyzer over SDK source → `ref/api.json` (Dart package
      `extractor/`, analyzer 14): 1547 entities (543 widgets incl. named
      constructors, 835 classes, 169 enums, 11570 static constants incl.
      Icons/Colors/Curves), full dartdoc + per-param field docs + defaults +
      supertypes; byte-deterministic (no timestamps), gated by ground-truth tests
      against the real SDK and a 100%-line Dart coverage gate. Requires
      `flutter update-packages` once (auto-run by `bun run extract`) so `dart:ui`
      types (VoidCallback) resolve.
- [x] 5. `api.json` schema + validating loader (TS) — `src/api/`: typed model
      (discriminated unions for entities and type nodes), validating parser with
      path-precise errors, canonical serializer, loader. Proven by a lossless
      full-file roundtrip: `serialize(parse(api.json))` is byte-identical to the
      committed 15 MB snapshot. `ref/` is prettier-ignored — the extractor is the
      sole formatting authority (prettier corrupting `.dart_tool`/`ref` caused a
      real hang + reformat; both now ignored).
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
