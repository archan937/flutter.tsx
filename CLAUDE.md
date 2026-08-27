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
bun run lint:extractor             # dart format + analyze (seconds)
bun run test:extractor             # dart tests + 100% coverage gate
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
      `useCamera` conformance target (originally a `flutter-tsx/plugins` subpath;
      replaced at step 14 by the `plugin:camera` import scheme — see step 22),
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
      `plugin:<pub-name>` modules, pub package captured), handlers (async-aware),
      useEffect calls, and the JSX root. Numbered diagnostics with file:line:column (TSX0100/0102/0103), pinned
      exactly. Camera fixture analysis asserted in full.
- [x] 12. Flutter IR + JSX→IR lowering (`src/compiler/ir.ts` + `lower.ts`): plain-data
      widget tree with slot-resolved arguments. Lowers attrs (string/number/boolean/
      enum-validated/handlerRef/stateRef/raw), children per slot kind (text content,
      single child, lists with `&&` → collection-if, auto Text-wrapping, state refs),
      stateless/stateful classification. Diagnostics TSX0201–0204 pinned exactly.
      Camera fixture IR asserted in full.
- [x] 13. Dart AST + printer + IR→Dart (`dart-ast.ts`, `dart-print.ts`,
      `ir-to-dart.ts`): expression tree with width-aware printing (inline ≤ 60 chars,
      else tall with trailing commas; canonical form still comes from `dart format`
      in the pipeline), string escaping, collection-if, const inference with
      topmost-only `const` (no redundant inner consts), private member naming
      (`_taken`, `_takePhoto`). Camera body prints exactly.
- [x] 14. Component class emission → **the first green golden**
      (`02-hello-column`, plain `test` in the `GREEN_FIXTURES` set — no longer
      `test.failing`) and **the first green from-TSX e2e**
      (`e2e/test/build-hello-from-tsx.test.ts`: `input.tsx` → byte-equal to the
      certified golden → real web build, ~17 s). `transpileComponent` is real
      and async (`emit-component.ts`: StatelessWidget class, `build` with the
      printed body re-indented; imports derived from the widget libraries
      actually used — cupertino/material/both, `widgets`-only defaults to
      material — cached CompileContext from api.json + slots). Emitter output
      must BE formatted Dart — byte-equality against the golden, no
      canonicalization pass. Anything non-stateless (state/plugins/effects/
      handlers) is the honest numbered error TSX0301 at the component name —
      never silent wrong Dart — so the camera fixture and its e2e stay RED.
      The 543-widget sweep now really transpiles + analyzes every probe in its
      own Dart package (`test/sweep/`; green since step 23).
- [x] 15. Value-type prop transforms — **golden #2 green** (`03-styled-container`:
      padding/hex color/alignment/TextStyle object, byte-equal to `dart format`).
      Data-driven from api.json, no hand lists: **constant unions**
      (`src/derive/value-forms.ts` — every class type accepts the string names of
      SDK constants assignable to it via `hierarchy`; owner resolution: exact type
      → most members → alphabetical; so `color="deepPurple"`→`Colors.deepPurple`,
      `alignment="center"`, `fontWeight: 'bold'`, curves, icons — ~100 color names
      alone), **hex colors** (`#RGB/#RRGGBB/#RRGGBBAA`→`Color(0xAARRGGBB)`),
      **EdgeInsets recipes** (number→`.all`, `{horizontal,vertical}`→`.symmetric`,
      `{left,top,right,bottom}`→`.only`), **object literals → const constructors**
      (any class whose default ctor is const + all-named-optional: TextStyle,
      BoxDecoration… 166 classes; values recurse — `style={{ color: 'white' }}`
      → `TextStyle(color: Colors.white)`; the vision's §Styling verbatim).
      Generated types match exactly: `ColorValue`/`TextStyleObject`… aliases in
      widgets.ts, negative cases pinned in type-safety.typecheck.ts. Enablers
      that landed en route: **extractor records constructor const-ness**
      (`"const"` in api.json — also fixed the latent const-inference bug:
      `Container(...)` no longer emitted as `const`), **framework-beats-dart:ui
      name collisions** (painting's TextStyle with its const ctor + `inherit`,
      not ui's — 67 entities re-owned, ground-truth pinned), **column-aware
      printer** (real 80-col fit at final position; collections split when their
      call splits — refined at step 23 to dart_style's actual hug rule, see the
      property-reads entry — byte-parity with `dart format` proven by the
      goldens),
      honest guards TSX0205–0208 (inexpressible value / bad insets shape /
      unknown object property / children on a slotless widget — no silent wrong
      Dart), and JSX elements as prop values (`appBar={<AppBar/>}` → named slot).
      Docs examples now use the string forms (placeholders 190→145; the rest
      need callbacks/controllers/Animation, later traits). Sweep: 394 probes
      transpile, 40 analyze issues left (red, next traits).
- [x] 16. Sweep hardening — **golden #3 green** (`04-inline-handler`) and the
      543-widget sweep down to **3 known analyze issues from 40** (394 probes)
      — all three closed at step 23, see the assert-implied requirements entry.
      Landed: **inline handler closures** (`onChanged={() => {}}` →
      `onChanged: (_) {}` — Dart arity from the param's function type, TS
      `_`-prefixed params → Dart `_` wildcard; bodies are TSX0302 until step
      18), **export-accurate imports** (extractor records which barrels
      re-export each entity — `"exports"` in api.json; emit covers used names
      minimally: material-all → cupertino-all → both + own defining barrel, so
      `ContentSensitivity` pulls `package:flutter/services.dart`),
      **assert-aware const inference** (extractor flags ctor asserts that
      access parameter members like `children.length` — those can never be
      const-invoked; 6 toolbar/section widgets now emit non-const), **const
      collection literals** (`children: const [...]` on maximal-const lists
      under non-const parents — prefer_const_literals compliant), and
      synthesize honesty (double probes use 1 not 16 — opacity asserts; sets,
      non-`Widget` single slots, and required keys are incomplete, not wrong).
      Sweep package ignores deprecated_member_use + avoid_unnecessary_containers
      (breadth probes cover deprecated widgets by design). **Sweep's known
      remainder (3, red via test.failing): Tooltip, CupertinoActionSheet,
      BackdropFilter — value-dependent asserts over optional params
      (message-or-richMessage etc.); needs assert-aware example synthesis,
      revisit with the docs step.**
- [x] 17. useState → StatefulWidget — **golden #4 green** (`05-counter`) and the
      **first stateful from-TSX e2e web build**
      (`e2e/test/build-counter-from-tsx.test.ts`). `useState` emits the
      StatefulWidget/State pair (typed private fields with translated
      initializers), named handlers become State methods (`async` →
      `Future<void> … async`), and consecutive setter calls merge into ONE
      `setState` with idiomatic assignments (`setCount(count + 1)` →
      `_count++`, `+ n` → `+= n`, `- 1` → `--`, else `_x = expr`). New
      `src/compiler/translate.ts`: the expression translator (literals,
      state/handler renames, binary/unary with `===`→`==`, template literals →
      Dart interpolation) — everything else is an honest TSX0305. Text slots
      interpolate (`<Text>Count: {count}</Text>` → `Text('Count: $_count')`),
      and scalar expression children wrap in Text per the DX contract
      (`{count}` → `Text('$_count')`, string states → `Text(_label)` — bare
      scalars in children lists were silently invalid Dart before). Guard
      split: plugins → TSX0304 (step 22, keeps camera red), useEffect →
      TSX0303 (step 18); TSX0301 is retired. `front-end.ts` renamed to
      `analyze.ts` (Paul: the old name was misleading); import resolution
      split out of emit-component into `compiler/imports.ts`.
- [x] 18. useEffect → lifecycle + inline handler bodies + ternaries — **golden #5
      green** (`06-mount-effect`, hand-written first and matched byte-for-byte on
      the first compiler run) and its from-TSX e2e web build. Mount effects
      (`useEffect(fn, [])`) emit `initState` with `super.initState()` and plain
      assignments (no setState before build — senior Dart); dependency-driven
      effects are TSX0306, cleanups TSX0307 (they need plugin controllers, step
      22). Inline handler bodies now compile: single setter →
      `() => setState(() => _checks++)`, multi-statement → block closures
      (TSX0302 retired); shared statement rendering lives in
      `compiler/statements.ts` (method-block form for State methods, arrow/block
      for closures, plain lines for initState). Ternary children lower to Dart
      conditionals (`{online ? <A/> : <B/>}`) — inline when they fit, split
      before `?`/`:` like dart format — including single-child slots, whose
      expression children were silently DROPPED before (found by TDD).
      translate.ts gains ternaries and `??`. TSX0303 retired (effects compile).
- [x] 19. List rendering — **golden #6 green** (`07-list-rendering`, hand-written
      first) and its from-TSX e2e web build. `{items.map((item) => <Text>{item}</Text>)}`
      → `for (final item in _items) Text(item)` (collection-for); loop locals are
      typed from the iterable's state type so String items print as `Text(item)`,
      not `Text('$item')`; array-literal iterables work (`['a','b'].map(...)`).
      List states infer `List<T>` from their initializer (`useState(['a'])` →
      `List<String>` field; empty literal → TSX0308); translate.ts gains array
      literals + spreads (`setItems([...items, 'Milk'])` →
      `_items = [..._items, 'Milk']`). `FlutterChild` is now recursive (arrays
      nest, like React's ReactNode) so map expressions typecheck inside children.
      Index-parameter maps, block bodies, and non-map calls are honest TSX0305s.
- [x] 20. Composition — **golden #7 green** (`08-composition`, hand-written first)
      and its from-TSX e2e web build. User components render as widgets:
      `<Greeting name="Paul" />` resolves through a per-file user-widget registry
      (same lowering path as SDK widgets — value forms, TSX0202/0208 guards, and
      const inference all apply; user ctors are const so composition trees fold
      into `const`). Typed destructured props become Flutter constructor
      params + final fields (`({ name }: { name: string })` →
      `const Greeting({super.key, required this.name}); final String name;`,
      optional `?:` → nullable non-required); String props print plain in Text.
      Non-exported components compile too (TSX0103 now requires ≥1 *exported*).
      Honest guards: untyped/named prop types → TSX0309 (inline type literals
      only until step 21), props + state on one component → TSX0310. User
      widget names never pull imports.
- [x] 21. Typed props, fragments, final fields — **golden #8 green**
      (`09-typed-props`, hand-written first) and its from-TSX e2e web build.
      Named prop types resolve locally (`interface TaskProps { … }` and
      `type X = { … }` — same TSX0309 for anything unresolvable); fragments
      splice into parent children lists and a fragment ROOT auto-wraps in a
      Column (vision rule 4); setter-less `const [titles] = useState(...)` and
      unused setters emit `final` fields (prefer_final_fields-clean — setter
      usage is counted in the component body); `.length` translates (shared
      TS/Dart member allow-list, everything else TSX0305); string-typed
      ternaries in text slots print plain (`Text(done ? '✓ \$title' : title)`),
      not wrapped in interpolation.
- [ ] 21b. Compiler-core remainder, each with its own golden when it lands;
      diagnostics with file/line + fix hints. Traits still open:
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
- [x] 22. **THE TRUST MILESTONE: conformance fixture #1 is green.** The flagship
      camera snippet transpiles byte-for-byte to its hand-certified golden and
      builds as a real Flutter web app from TSX (`build-from-tsx.test.ts` flipped
      to a plain test). Architecture as agreed with Paul (generic, on-demand — no
      hand-curated plugin catalog): **plugin extraction** (`extractPluginApi` —
      the Dart analyzer reads the plugin source resolved through a depending
      project, exactly as fsx will do in user projects; instance methods +
      top-level functions now extracted; `ref/plugins/camera.json` committed and
      byte-freshness-pinned in the Dart tests; `bun run extract:plugin <pkg>`),
      **derived hooks** (`deriveHooks` — controller pattern detected from
      `initialize()`/`dispose()` signatures; constructor args resolved
      mechanically: `availableCameras() → cameras.first` supplier rule, enum
      defaults from tier-3 overrides), **hand overrides** shrunk to judgment only
      (`src/plugins/overrides.ts`: camera = `ResolutionPreset: 'high'`, one
      line), **generated ambient typings** (`bun run generate:plugin camera` →
      `test/fixtures/types/camera.d.ts`, freshness-pinned; the hook returns
      `Omit<CameraController, 'initialize' | 'dispose'>` so managed lifecycle
      members are IDE errors; Dart operator methods filtered; SDK enum/widget
      refs import from flutter-tsx), and **compiler integration** (plugin field
      `CameraController? _cam`, `_initCam()` with mounted guard, `dispose()`
      override, `await cam.takePicture()` → `await _cam?.takePicture();`,
      plugin imports merged and sorted). Honest errors: TSX0311 unknown hook,
      TSX0312 unknown plugin method, loud error for unextracted plugins;
      TSX0304 retired.
- [x] 22b. Hook options — **golden #10 green** (`10-camera-options`, hand-written
      first, matched on the first compiler run) and its from-TSX e2e web build.
      `useCamera({ resolution: 'veryHigh' })` → `ResolutionPreset.veryHigh`:
      options derive mechanically from the constructor's enum params (values
      from the plugin's own enums; DX names via a one-line override,
      `resolutionPreset` → `resolution`); the generated declaration types them
      (`useCamera(options?: { resolution?: ResolutionPreset })`); defaults keep
      `useCamera()` byte-identical. Construct lines wrap width-aware when they
      exceed 80 columns (dart-format-conformant). Honest errors: TSX0313
      unknown option, TSX0203 invalid member, TSX0206 non-literal options.
      (Supplier filters — `lens: 'front'` — landed at step 23; see the
      supplier-filter entry.)
- [x] 23a. **Runtime behavior tests — the top rung of the sign-off ladder has
      real weight now.** `e2e/test/behavior.test.ts`: the transpiled fixtures
      EXECUTE headlessly via Flutter widget tests (`flutter test`, no device,
      no chromedriver, ~16s for all three): the counter increments through
      real setState taps (`Count: 0 → 1 → 2`), the mount effect runs in
      initState (`Online` renders, `Offline` never does), and list rendering
      rebuilds after the spread-append (`Milk` appears). This closes the
      "compiles-but-does-it-behave" gap from the 2026-08-27 assessment;
      hardware plugin behavior (camera) remains honestly behind the
      real-device gate — widget tests can't drive platform channels.
- [x] 23 (storage breed). **Singleton services derive with ZERO hand data** —
      golden #11 green (`11-preferences`, hand-written first, matched on the
      first compiler run) + e2e web build + **runtime persistence proof**
      (widget test taps Save and asserts `prefs.getString('name') == 'Paul'`
      through the mock store — the derived hook really stores data).
      Derivation pattern #2: a static async factory
      (`static Future<Self> getInstance()`) → singleton hook (acquire in
      initState with mounted guard, no dispose, plain class handle — no Omit).
      Enablers: static methods now extract (`"static"` on methods in plugin
      JSON — schema caught by the camera freshness pin, both plugin APIs
      regenerated); `DerivedHook.acquisition` discriminates constructor vs
      staticFactory; `ref/plugins/shared_preferences.json` committed +
      freshness-pinned; generated declaration emits `static` members.
- [x] 23 (service breed). **Const-field services + named arguments** — golden
      #12 green (`12-secure-storage`) + e2e web build + runtime persistence
      proof (widget test taps Save, reads `'secret'` back through
      `FlutterSecureStorage.setMockInitialValues`). Derivation pattern #3: a
      class named after the package with a zero-required constructor and
      instance methods → `final X _x = const X();`, no lifecycle at all.
      A trailing TSX object literal expands into Dart named arguments
      validated against the extracted method signature (TSX0314 unknown
      name). staticFactory relaxed to all-optional params
      (`PackageInfo.fromPlatform` derives — pinned in hooks tests). Every
      extracted plugin's d.ts is now byte-fresh-pinned (closed the unpinned
      shared_preferences gap). Import directives sort in code-unit order.
- [x] 23 (navigation breed). **Top-level plugin functions** — golden #13 green
      (`13-open-link`) + e2e web build + runtime proof through a fake
      `UrlLauncherPlatform` (asserts the URL AND the enum named argument
      reach the platform). `import { launchUrl } from 'plugin:url_launcher'`
      → direct Dart function call with the package import recorded. Dart
      core `Uri` params surface as `string` in typings and the compiler
      wraps with `Uri.parse(...)`; enum-typed arguments translate
      (`'externalApplication'` → `LaunchMode.externalApplication`, TSX0203
      for unknown members). Statement-position calls wrap at 80 columns in
      the dart-format canonical one-arg-per-line split.
- [x] 23 (property reads + printer hug rule). **Plugin properties read
      straight in JSX** — golden #14 green (`14-app-info`) + e2e web build +
      runtime proof (widget test asserts the pre-resolution fallback renders,
      then the resolved `appName`/`version` after `pumpAndSettle`). The
      extractor now captures instance fields and getters (analyzer
      `isOriginVariable` picks up both; `hashCode`/`runtimeType` excluded),
      generated typings expose them as `readonly` members, and a read through
      a nullable handle carries its own Dart zero-value fallback
      (`_info?.appName ?? ''`) so no downstream context needs coercion.
      Honest bounds: TSX0315 unknown property, TSX0316 a field type with no
      zero value (read it in a handler and store it in state).
      **Printer correction:** the old rule ("collections split whenever their
      call splits") was wrong. Established from `dart format` itself: a SOLE
      block-like argument hugs — the collection stays on the argument line
      when it fits — UNLESS an element carries named arguments of its own
      (only the element's own argument list counts, not one nested deeper).
      That rule reproduces every committed golden, including #08's split
      `Greeting(name: ...)` list and #14's inline `Text(...)` list.
      Also closed: every committed `ref/plugins/*.json` snapshot is now
      byte-fresh-pinned by the Dart suite (was camera + shared_preferences
      only), so a schema change can never leave a stale snapshot behind.
- [x] 23 (supplier filters). **`useCamera({ lens: 'front' })` — the 22b
      deferral is closed, and derived, not hand-written.** Every enum-typed
      field on a supplier's element type becomes an optional filter: omit it
      and the supplier's first item is used (fixtures #1/#10 unchanged), pass
      it and codegen emits `firstWhere` with an `orElse: () => xs.first`
      fallback so a missing device never throws. Two filters combine into one
      `&&` predicate wrapped exactly as `dart format` wraps it (verified
      against the formatter before implementing). `CameraDescription` yields
      `lens` (lensDirection, renamed by the existing one-line optionNames
      override) and `lensType` — zero new hand data beyond that rename. The
      selected local is named after the constructor's own parameter
      (`description`), so no name is invented. Golden #15 (`15-front-camera`)
      matched byte-for-byte on the first compiler run; e2e web build green;
      capture itself stays behind the real-device gate.
- [x] 23 (permissions manifest data). **What a host app must declare is now
      extracted from the plugin's real artifacts, not guessed.** Per plugin:
      Android `uses-permission` names from the resolved `default_package`'s
      own manifest (the file Gradle merges into the app) and the `<queries>`
      schemes from its example app manifest, which merging cannot supply;
      iOS `NS*UsageDescription` keys and `LSApplicationQueriesSchemes` from
      the example Info.plist (only the KEYS are derivable — the strings are
      app-specific copy a developer writes). The `default_package` per
      platform comes from the plugin's own `flutter: plugin: platforms:`
      block, so the implementation package is never guessed by name.
      Ground truths pinned: camera → CAMERA/RECORD_AUDIO/
      WRITE_EXTERNAL_STORAGE + NSCamera/NSMicrophoneUsageDescription;
      url_launcher → no permissions but `https`/`sms`/`tel` query schemes
      (reporting "nothing needed" there would have been a lie, which is why
      `<queries>` extraction exists). **Absent artifacts are reported, never
      silently empty:** each list carries its own source, and
      `manifestRequirements(apis)` returns an `unknown[]` naming every
      plugin whose artifact was missing, so a consumer can never read
      "no data" as "no requirements". Writing these into a scaffolded app's
      AndroidManifest.xml / Info.plist belongs to `fsx init` at steps 25–28
      (there is no app manifest to write into before the scaffolder exists);
      the data and the merge function are done and tested here.
- [x] 23 (assert-implied requirements — THE SWEEP IS GREEN). The 543-widget
      breadth net passes for the first time: every complete synthesized
      example transpiles to Dart that `flutter analyze`s clean (was 3 known
      `const_eval_throws_exception` reds: Tooltip, CupertinoActionSheet,
      BackdropFilter). Root cause was a real guardrail hole, not a probe
      quirk: Flutter states some requirements only in a constructor assert
      (`assert(filter != null || filterConfig != null)`,
      `assert((message == null) != (richMessage == null))`), where every
      member is an optional param and no type can carry the constraint — so
      a developer could write `<Tooltip><Text/></Tooltip>` and only find out
      when Dart analysis failed. Now: the extractor reads those asserts from
      the SDK AST and records `requiredOneOf` groups (14 constructors
      SDK-wide) — disjunctions of null checks and the exclusive-or form, and
      deliberately NOT `a == null || b == null`, which is mutual exclusion
      rather than a requirement; **TSX0317** fires on TSX when a group is
      unsatisfied, so the error lands on the source instead of on generated
      Dart that throws; the example synthesizer satisfies each group with
      its first expressible member. Examples whose groups need a value the
      compiler cannot express yet (BackdropFilter's ImageFilter) are marked
      incomplete with a visible `{…}` placeholder — placeholders 145→150,
      honestly excluded from the sweep instead of silently emitting throwing
      Dart. `sweep.test.ts` is now a plain green test, not `test.failing`.
- [x] 23 (breed matrix status). controller ✓ camera (goldens #1, #10);
      storage ✓ shared_preferences (golden #11); service/auth ✓
      flutter_secure_storage (golden #12); navigation-function ✓
      url_launcher (golden #13); staticFactory generality ✓ package_info_plus
      (golden #14 — property reads landed, so this breed is now proven
      end-to-end too); hardware runtime stays behind the real-device gate;
      router navigation (go_router) deferred to 24b; permissions data ✓ (see
      the permissions entry — manifest writing lands with the CLI at 25–28).
      Behavior tests
      accompany each new stateful trait. **Decided (Paul,
      2026-08-24): plugin hooks import from `plugin:<pub-name>` (e.g.
      `import { useCamera } from 'plugin:camera'`) — collision-proof scheme prefix,
      1:1 with the pub package. Versions live in a `"plugins": {"camera": "^0.12"}`
      map in the project package.json; fsx syncs it to pubspec.yaml and generates
      ambient `declare module 'plugin:x'` types per project via the Dart-analyzer
      extraction pipeline, for the resolved plugin version. Two layers: typed API
      surface (automatic, any plugin) vs `useXxx` hooks (hand-tuned codegen recipes,
      curated set only — a hook's lifecycle semantics are never guessed). Fixture,
      README, and front-end switched at step 14;
      `test/fixtures/types/camera.d.ts` is the hand-written preview of the
      generated declaration; the `flutter-tsx/plugins` subpath export is gone.
      To discuss thoroughly with Paul at this step (deferred 2026-08-24): recipe
      anatomy (state/teardown/method-rewrite templates) and hook options —
      parameter slots like `useCamera({ resolution: 'high', lens: 'front' })`,
      each speced with its own fixture before being documented.**
- [x] 24b (gesture props). **Any widget takes gesture props; the compiler
      wraps.** `<Container onClick={bump} onLongPress={bump}>` →
      `GestureDetector(onTap: _bump, onLongPress: _bump, child: Container(…))`.
      The allowed set is DERIVED from GestureDetector's own constructor —
      every `on*` param whose type is a function, so a new SDK gesture needs
      no code change (66 params, all the tap/drag/scale/pan callbacks come
      free). A widget's own prop of that name always wins, so `ListTile
      onClick` stays on the ListTile and never wraps; an unknown prop that is
      no gesture is still TSX0202. Const inference is unaffected: the wrapper
      carries a handler reference so it is non-const while its child stays
      `const Text(…)`. Golden #16 (`16-tap-target`) certified and byte-equal,
      plus a widget test proving a tap AND a long press each reach the
      handler at runtime. **The typecheck gate caught the half-measure:**
      wrapping in the compiler is worthless if the TS types reject the prop,
      so the generator now emits a `GestureProps` interface (also derived
      from GestureDetector) that all 509 widget interfaces inherit —
      `extends GestureProps`, or `extends Omit<GestureProps, 'onClick'>`
      where the widget declares that prop itself, so its own signature
      always wins and TS never sees a clash.
- [x] 24b (useAsync → FutureBuilder). **The vision's headline async story,
      proven end-to-end.** An `async` component with
      `const x = await useAsync(() => <future>, { loading, error })` becomes a
      StatefulWidget whose build is a `FutureBuilder<T>`: a
      `late final Future<T> _xFuture` assigned in initState, then guarded
      branches — `snapshot.hasError` (binds the error as a String),
      `!snapshot.hasData` (the loading fallback), and the fall-through binding
      `final x = snapshot.data!` before the component's own JSX. T is derived
      from the future's own Dart type, so `FutureBuilder<bool>` and
      `snapshot.data!` are correctly typed with no annotation in the TSX.
      New printer capability: a `builder` AST node that always renders tall
      with real column-aware nesting (StreamBuilder will reuse it), plus a
      fix to the fit rule — a form that already spans lines can never "fit"
      on one, which also hardens block-bodied closures.
      Honest bounds, all numbered: TSX0318 one useAsync per component,
      TSX0319 both fallbacks required (every FutureBuilder state must render
      something), TSX0320 the call shape, TSX0321 the future must be one
      whose Dart type the compiler knows — today a plugin method call.
      A local async function body (and therefore `fetch()`) needs the HTTP
      mapping decision that the roadmap parks with Paul, so it errors loudly
      instead of guessing. Golden #17 (`17-async-token`) certified and
      byte-equal; widget tests prove the loading fallback renders on the
      first frame and that both resolved branches follow.
- [x] 24b (useStream → StreamBuilder). Same shape as useAsync over a Dart
      Stream: `await useStream(() => connectivity.onConnectivityChanged, {…})`
      → `late final Stream<T>` assigned in initState plus a
      `StreamBuilder<T>` reusing the builder AST node. The source may now be
      a plugin PROPERTY read, not just a method call (a stream is usually a
      getter), and the diagnostics generalised to name whichever hook and
      wrapper is involved. **Two real extraction gaps closed on the way:**
      (1) type arguments of `Stream<…>` were silently dropped —
      `Stream<List<ConnectivityResult>>` came out as a bare `named: Stream`,
      so a `stream` TypeNode kind now mirrors `future` end to end (Dart
      encoder → snapshot → parse/serialize → dartTypeOf → generated
      typings, where it surfaces as `AsyncIterable<T>` and carries the item
      type into `useStream`'s inference); (2) the service-hook match compared
      the class name against the full package name, so the pub "plus family"
      (connectivity_plus, battery_plus, sensors_plus) derived nothing — the
      suffix is now stripped, which is why `useConnectivity` exists, while
      package_info_plus still derives its static factory rather than a
      service. Known remaining limitation, recorded rather than hidden:
      type arguments of OTHER generic named types are still dropped
      (`ValueNotifier<int>` → `ValueNotifier`); nothing in the fixtures or
      the 543-widget sweep depends on one, and any use would fail loudly at
      `flutter analyze` rather than silently miscompile.
      Golden #18 (`18-connectivity-stream`) certified and byte-equal on the
      first compiler run; the widget test proves the loading fallback renders
      before the first event and that EVERY event rebuilds.
- [x] 24b (createStore / useStore). **Global state without a dependency.**
      `const s = createStore({ count: 0, label: 'Taps' })` at module level
      generates a `ChangeNotifier` with typed fields and one `update({…})`
      that patches the given fields and notifies once, plus a single
      top-level instance. In a component,
      `const [state, setState] = useStore(s)` makes `state.count` read
      `_counterStore.count` and `setState({ count: … })` call
      `_counterStore.update(count: …)`; the component's body is wrapped in a
      `ListenableBuilder`, so a store-driven widget **stays a
      StatelessWidget** — the notifier drives the rebuild.
      **Deliberate deviation from the vision doc, with reason:** it specifies
      `ChangeNotifierProvider(create:) + Consumer` from the `provider`
      package. `create:` builds the store INSIDE the widget tree — one
      instance per provider — whereas `createStore` at module scope is a
      single shared instance, so provider would have changed the semantics,
      not just the plumbing. SDK-native `ListenableBuilder` is the faithful
      translation and adds no third-party dependency. A tree-scoped variant
      (provider or riverpod) remains open if Paul wants scoped stores later.
      Honest bounds, numbered: TSX0322 unknown store, TSX0323 a field whose
      literal the compiler cannot type (string/number/boolean only — no
      nested objects or `new Date()`), TSX0324 the destructuring shape,
      TSX0325 the setter's argument shape, TSX0326 an unknown field in a
      patch. Reads generalised: the plugin-read machinery became
      `memberReads`, so plugin handles (nullable, zero-value fallback) and
      store instances (always present) share one path.
      Golden #19 (`19-store-counter`) certified and byte-equal; widget tests
      prove taps rebuild a stateless widget and that two widgets on one store
      always show the same value.
- [x] 24b (useNavigation / createRouter → GoRouter). **Real routing, proven
      by an actual page transition.** `createRouter({ '/': HomePage })` at
      module level generates `final GoRouter router = GoRouter(routes: [...])`
      with one `GoRoute` per entry; `const nav = useNavigation()` plus
      `nav.push('/detail')` / `nav.pop()` compile onto go_router's
      BuildContext extension (`context.push('/detail')`) — the build method
      already has the context, so no navigator is threaded by hand and the
      `go_router` import is recorded from use.
      Typed guardrail: a route target is `() => FlutterElement`, so a
      component needing props is rejected by TypeScript rather than by the
      Dart compiler. Numbered bounds: TSX0327 the route-table shape, TSX0328
      a route pointing at something that is not a component in this file,
      TSX0329 an unknown navigation method (push/replace/go/pop).
      Two fixes found while building it: `pluginImports` was read from the
      object literal BEFORE the body was lowered, so any import discovered
      while lowering a handler was recorded too late (the body is now lowered
      first); and a closure holding one single-line statement now renders as
      an expression body (`() => context.push('/detail')`) the way a lone
      setState already did.
      Golden #20 (`20-router`) certified and byte-equal; the widget test taps
      through push and pop and asserts the pages actually swap.
- [x] 24b (Modal). `nav.present(<ConfirmDialog />)` → `showDialog(context:
      context, builder: (context) => const ConfirmDialog())`, and
      `nav.presentSheet(<SheetBody />)` → `showModalBottomSheet(…)` — both
      through the navigation handle added with the router, so the widget to
      open is ordinary JSX and gets lowered like any other. TSX0330 when the
      argument is not a widget.
      **Enabler, and a real gap closed:** statements were strings, so a call
      that needs to wrap could only be indented by assumption. `IrStatement`
      now has an `expr` kind carrying an `IrValue`, and `ClosureBody` a
      `value` kind, both printed column-aware — which is the only way to get
      the golden's `onPressed: () => showDialog(\n  context: context,\n  …,\n)`
      byte-exact. A lone expression statement in a closure therefore becomes
      an arrow body automatically.
      Golden #21 (`21-modal`) certified and byte-equal on the first run; the
      widget test opens the dialog, dismisses it by tapping the barrier
      (which only a real modal route allows) and then opens the sheet.
- [x] 24b (presenting from a mount effect — a facade found and closed).
      `nav.present()` inside `useEffect` was generating `showDialog(...)`
      straight into `initState`, which **throws at runtime in Flutter** (the
      Navigator lookup is illegal before initState completes). Found by
      chasing an uncovered line rather than by a failing test, and fixed
      properly instead of being reported: an effect containing a presentation
      is wrapped in
      `WidgetsBinding.instance.addPostFrameCallback((_) { … })`, which is the
      idiom a senior Flutter developer writes for exactly this. The whole
      effect body goes inside the callback, so a `setState` after the
      presentation still runs (and setState after the first frame is legal).
      Golden #22 (`22-mount-dialog`) certified and byte-equal; the widget
      test asserts nothing is presented on the first frame and that the
      dialog plus the following state change both land after it settles.
      Also unified: `initStateLines` and `methodStatementLines` were two
      walks over the same statements differing only in setState wrapping —
      now one walk, so every statement kind has exactly one renderer.
- [ ] 24b. Remaining high-level abstractions from the vision (each gated by its own golden +
      e2e before being documented): `useAsync`/`Query`→FutureBuilder ·
      `useStream`→StreamBuilder · `createStore`/`useStore`→ChangeNotifier+Provider ·
      `useNavigation`/`<Router>`→GoRouter · `Modal` · `TabView` · `<Animated>` ·
      gesture props (onTap/onLongPress→GestureDetector wrap) · `fetch()`→Dart HTTP
      (mapping choice, e.g. package:http, is an open design decision for Paul)
- [ ] 25–28. `fsx` CLI (init/dev/build/doctor) + `create-flutter-tsx` scaffolder
- [ ] 29–31. CI pipeline, docs from fixtures + site deploy, 1.0 publish (Paul triggers).
      **Paul (2026-08-25): the preserved v1 pages (docs/index.html, guide.md,
      config-mapping.md) stay frozen and unmarked until the step-30 refresh —
      they present v1 as current; fix belongs to the site refresh, not before.**
