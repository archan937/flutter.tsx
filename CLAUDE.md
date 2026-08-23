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

## Guarantee Model (the no-facade contract)

**Nothing is claimed, documented, or called "supported" without a green end-to-end
proof.** E2E is the real sign-off. Concretely:

- **Traits, not widgets, get hand-written proofs.** The compiler is data-driven, so
  golden + e2e fixtures cover 100% of *traits* (~15: children-list, single child,
  text content, named/typed slots, positional params, enum props, constant props,
  value-type props, sync/async callbacks, state, effects, conditionals, lists,
  composition) plus combination fixtures (the camera snippet). A trait proven for
  Column is proven for Row — same code path.
- **The exhaustive net is generated, not hand-written:** one minimal TSX usage per
  widget, auto-generated from its own types, transpiled for ALL 543 widgets and
  `dart analyze`d in CI. Depth from trait fixtures, breadth from the sweep.
- **Plugins are sampled by breed** (device-hardware+permissions, storage-like,
  controller-like, service/auth-like, navigation): 1–2 full e2e per breed
  (hardware breeds in the opt-in real-device pre-release gate), every other
  plugin's codegen template mechanically verified; anything without its e2e is
  marked experimental, never "supported".
- **Docs are fixtures, structurally:** doc builds *include* fixture source files
  verbatim — a snippet cannot appear anywhere unless CI transpiled, analyzed, and
  built it as a real project.
- **Sign-off ladder (CI, every commit):** analyze sweep (all widgets) → golden
  diffs (all traits) → `flutter build web` (all doc fixtures) → `flutter run` +
  scripted interaction (flagship fixtures); real-device gate before any publish.
- **Assertions are exact full blocks everywhere** — goldens, sweeps, e2e output,
  error messages. Never `contains`-style checks (format both sides with the same
  formatter when needed).
- **Input-language totality (no unknown-unknowns):** everything a user can type is
  the union of three finite, closed sets — (1) TypeScript's own `SyntaxKind` enum
  (~360 node kinds), (2) the built-in stdlib member surface per receiver type
  (Array/String/Map/Set/Promise/…), (3) our own exports. The compiler must classify
  every member of all three as supported (trait + golden), forbidden (numbered
  TSX error), or contextual — enforced by a generated, freshness-gated coverage
  ledger and by the compiler's default case throwing a numbered diagnostic.
  Unhandled input can only ever produce a loud precise error, never silent wrong
  Dart. The ledger lands with step 11's front end.

## Code Conventions

- **Path aliases in tests/tooling; relative imports in shipped code.** `@src/*`,
  `@test/*`, `@scripts/*` (tsconfig `paths`, Bun-native) are used in `test/` and
  `scripts/` only. Files under `src/` are consumed by other packages' compilers,
  where the aliases cannot resolve — shipped code uses shallow relative imports
  (this is a package-boundary constraint, proven by the e2e typecheck).
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
bun run derive                     # api.json → ref/derived/slots.json
bun run generate                   # api.json + slots → src/generated/*.ts
bun run verify:api                 # prove committed api.json == fresh extraction
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
- [x] 6. Slot-semantics derivation → `ref/derived/slots.json` (TS, `src/derive/slots.ts`):
      per-widget children slot (`children` list / single `child` / positional-String
      text content) + named widget slots matched by type through the new `hierarchy`
      section (all public classes AND mixins → supertypes, extracted from the SDK —
      how `AppBar` maps to Scaffold's `appBar: PreferredSizeWidget`). All 543 widgets
      covered; Scaffold/AppBar surfaces pinned exactly against the real SDK; committed
      slots.json is freshness-gated by a test, and `bun run verify:api` proves the
      committed api.json matches a fresh extraction byte-for-byte (CI gate at step 29).
- [x] 7. TS type generator → `src/generated/` (`bun run generate`, freshness-gated):
      `widgets.ts` (3.2 MB) + `constants.ts` (2.4 MB) — all 543 widgets as typed
      components with per-prop dartdoc JSDoc, slot-aware `children` typing, enums as
      literal unions, hierarchy-branded opaque class types (Colors.red: MaterialColor
      assignable to Color), Icons/Colors/Curves namespaces, onPressed/onTap → onClick.
      Compile-time proofs in `test/generate/type-safety.typecheck.ts` (@ts-expect-error
      gate). Extraction expanded to ALL 14 Flutter barrels + dart:ui (1897 entities);
      caught + fixed: the Image widget was shadowed by dart:ui's Image class (widgets
      now win name collisions), and dangling enum refs fail generation loudly.
- [x] 7b. API-reference generator ported (`src/site/`, `bun run docs`) and
      `docs/api-reference.html` regenerated from v2 data: 539 widgets (typed props
      tables, synthesized TSX examples, real extracted Dart constructor signatures)
      + 217 enums. Shell proven byte-identical to v1 (CSS diff-exact; JS exact modulo
      the repo rename). Honest content only: no Dart-transpilation output until the
      compiler exists; 185 examples carry a visible `{…}` placeholder until prop
      transforms (step 15); synthesized-example typecheck gate lands with step 8's
      JSX wiring; the landing page stays untouched until step 30. Freshness-gated
      byte-for-byte in the test suite (the no-stale-docs rule, mechanized).
- [x] 8. Runtime surface: jsx-runtime + jsx-dev-runtime (automatic JSX, typed JSX
      namespace, Fragment, key), useState/useEffect compile-target stubs, typed
      `flutter-tsx/plugins` with `useCamera` (conformance target; codegen at 22–24),
      public `index.ts`. **The camera snippet typechecks as a real fixture**
      (`test/fixtures/01-camera-screen/input.tsx`, package self-reference imports) —
      and immediately caught a generator precedence bug (`() => void | null`).
      All 349 complete API-reference examples compile via a generated probe
      (`test/site/__generated__/`, freshness-gated); the reference now shows a
      "✓ typechecked" badge + verification explainer. String/number children are
      valid anywhere a widget fits (compiler wraps in Text — DX contract). Widgets
      owning static constants carry them on the component (`Checkbox.width`).
- [x] 9. Golden runner live; **conformance fixture #1 is checked in RED**
      (`test.failing` — the suite stays green, and Bun forces the flip the moment a
      fixture unexpectedly passes). `test/fixtures/` is a real Dart package
      (flutter + camera ^0.12.0 + flutter_lints 6): every committed `expected.dart`
      is proven dart-format-stable and analyze-clean on every run, so the runner's
      byte-equality against a golden transitively proves format + analyze for
      compiler output. `01-camera-screen/expected.dart` is the hand-written codegen
      spec: StatefulWidget lowering, CameraController lifecycle (initState/dispose,
      mounted guard), async handler → method + setState, `taken &&` →
      collection-if, string child → const Text. `src/compiler/transpile.ts` exists
      as the honest not-implemented entry (throws, message pinned by test).
- [x] 10. E2E harness + sweep — gap #3 closed. GREEN: fixture #1's certified golden
      builds as a real Flutter web app (`e2e/test/build-golden.test.ts`:
      `flutter create` → `pub add camera` → `flutter build web`, ~16 s). RED
      (`test.failing`, flips when the compiler lands): the same pipeline from
      `input.tsx` (`build-from-tsx.test.ts`) and the 543-widget analyze sweep
      (`test/golden/sweep.test.ts`, ≥349 complete examples transpile + analyze).
      Harness scaffolds via `flutter create` for now; switches to the
      create-flutter-tsx template at steps 25–28.
- [x] 11. Compiler front end (`src/compiler/front-end.ts` + `diagnostics.ts`):
      ts.Program + checker over in-memory TSX; discovers exported arrow components;
      extracts useState bindings (value/setter/initial + Dart type inferred from the
      initial value: int/double/String/bool), plugin hooks (import-tracked from
      `flutter-tsx/plugins`), handlers (async-aware), useEffect calls, and the JSX
      root. Numbered diagnostics with file:line:column (TSX0100/0102/0103), pinned
      exactly. Camera fixture analysis asserted in full.
- [ ] 12–21. The compiler core: IR → Dart AST → emitter, one
      trait per step, each ending in a green golden fixture; diagnostics with
      file/line + fix hints. Traits: JSX→constructor · slots (child/children/
      named/text) · props/positional · string-children→Text · enum/constant props ·
      value-type prop transforms (color/padding/TextStyle…) · sync+async handlers ·
      useState→StatefulWidget · useEffect→lifecycle · conditionals · lists ·
      composition · Fragment + key semantics · **the TSX Strict Mode expression
      language** (if/switch/for-of/while/try-catch, map/filter/reduce→map/where/fold,
      `?.`/`??`, template literals, functions with default/rest/destructured params) ·
      **user-defined types→Dart** (type→class, interface→abstract class, enums,
      generics, tuples→records) · **multi-file modules** (user imports across files) ·
      app entry (`runApp` + MaterialApp wiring) · **TSX1001–3002 forbidden-feature
      error codes** (vision §11 — the full audited input-language inventory,
      2026-08-23; nothing from the vision docs is dropped silently)
- [ ] 22–24. Plugins: codegen data, `useCamera` end to end (fixture #1 fully green —
      the trust milestone), then one plugin at a time
- [ ] 24b. High-level abstractions from the vision (each gated by its own golden +
      e2e before being documented): `useAsync`/`Query`→FutureBuilder ·
      `useStream`→StreamBuilder · `createStore`/`useStore`→ChangeNotifier+Provider ·
      `useNavigation`/`<Router>`→GoRouter · `Modal` · `TabView` · `<Animated>` ·
      gesture props (onTap/onLongPress→GestureDetector wrap) · `fetch()`→Dart HTTP
      (mapping choice, e.g. package:http, is an open design decision for Paul)
- [ ] 25–28. `fsx` CLI (init/dev/build/doctor) + `create-flutter-tsx` scaffolder
- [ ] 29–31. CI pipeline, docs from fixtures + site deploy, 1.0 publish (Paul triggers)
