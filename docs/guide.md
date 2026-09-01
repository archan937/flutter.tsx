# Guide — working with Flutter.tsx

You write TSX; `fsx` compiles it to idiomatic Dart and drives Flutter. You never write
Dart by hand, and one codebase builds for web, iOS, Android, macOS, Windows and Linux.
Two of those — web and macOS — are built from TSX by the end-to-end suite on every run;
the other four take the same path through `flutter build` but are not covered by CI.

Every TSX snippet on this page is a conformance fixture from the compiler's test suite.
The Dart each one emits is asserted byte-for-byte, laid out by `dart format`, checked by
`flutter analyze` and built as a real Flutter app on every run — see the
[cookbook](./cookbook.html) for all of them, side by side.

## 1. Create a project

Flutter.tsx is not on npm yet — the `0.x` releases there are the previous
implementation. Until 1.0, run it from a clone:

```sh
git clone https://github.com/archan937/flutter.tsx
cd flutter.tsx && bun install
bun packages/flutter-tsx/bin/fsx.ts init ~/my-app
cd ~/my-app && bun install
```

Once 1.0 ships, the same project comes from:

```sh
npm create flutter-tsx@latest my-app   # or: bun create flutter-tsx my-app
cd my-app
bun install
```

You get `fsx.config.ts`, a `src/App.tsx` to start from, a `tsconfig.json` wired for TSX,
and the host Flutter app.

## 2. Start from a complete app

`--template` scaffolds one of four finished apps rather than the starter — the
same files, plus that app's own source and the pub packages it needs:

```sh
fsx init my-app --template=web       # album browser: routes, a store, models
fsx init my-app --template=mobile    # field notes: tabs, camera preview, keychain
fsx init my-app --template=desktop   # service console: master–detail, live build info
fsx init my-app --template=tray      # menu-bar companion: tray events, a live stream
```

Add `--target=<platform>` to build the same app for somewhere else —
`fsx init my-app --template=mobile --target=web` scaffolds the field-notes app
as a web project. The platforms are `android`, `ios`, `linux`, `macos`, `web`
and `windows`.

Every template is transpiled, analysed and built for its own platform on every
run of the end-to-end suite, and each one is committed under
[`examples/`](https://github.com/archan937/flutter.tsx/tree/master/examples) so
you can read it before you run anything. The [Examples](./examples.html) page
lists what each app demonstrates, file by file.

## 3. Install the SDK and your plugins

```sh
fsx install
```

One command does both: it downloads the pinned Flutter SDK into `~/.fsx` (shared by every
project on the machine, so it happens once), then brings the project's plugins in line
with what `package.json` declares.

## 4. Develop

```sh
fsx dev
```

`fsx dev` compiles every component under `src/` to Dart under `lib/`, runs the app on the
device your target maps to, and watches for saves: each one recompiles and hot reloads. A
compile error is reported and the app keeps running, so a typo never ends the session.

## 5. Write components

A component is an exported arrow function returning JSX. State is `useState`, and a
handler is a plain function:

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

That compiles to a `StatefulWidget` with a private `_count` field, a `_increment` method
that calls `setState`, and a `build` returning the `Column` — the Dart a Flutter
developer would have written.

Props are destructured with an inline type, and a component that both takes props and
owns state reads its props through `widget` in the emitted Dart — you never write that:

```tsx
import { Column, Text } from 'flutter-tsx';

export const TagList = ({ tags }: { tags: string[] }) => (
  <Column>
    {tags.map((tag) => (
      <Text>{tag}</Text>
    ))}
  </Column>
);
```

Components in other files are imported the way you would expect, and the compiler emits
the Dart import for you — including hiding a Flutter widget of the same name, so a
component called `Card` or `Banner` is yours, not the SDK's.

## 6. Use a plugin

Plugins are declared like npm dependencies, in `package.json`:

```jsonc
{
  "plugins": {
    "url_launcher": "^6.3.0"
  }
}
```

`fsx install` resolves them with pub, writes them into `pubspec.yaml`, extracts each
plugin's real API from the resolved source, and generates the `plugin:<name>` typings
your editor completes against. Then import from the plugin and call it:

```tsx
import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

export const OpenLink = () => {
  const [opened, setOpened] = useState(false);

  const open = async () => {
    await launchUrl('https://flutter.dev', { mode: 'externalApplication' });
    setOpened(true);
  };

  return (
    <Column>
      {opened && <Text>Opened!</Text>}
      <ElevatedButton onClick={open}>Open</ElevatedButton>
    </Column>
  );
};
```

The typings are generated from the plugin version your project resolved, so what the IDE
completes is what the plugin actually exposes. Dart types map to their TypeScript
counterparts — a Dart `Uri` is a `string`, an enum is a union of string literals — and the
compiler maps them back (`launchUrl('https://flutter.dev')` emits
`launchUrl(Uri.parse('https://flutter.dev'))`).

Plugins whose lifecycle needs owning get a hook: `useCamera()`, `useLocation()`,
`useSecureStorage()` and the rest acquire on mount and dispose on unmount, so a controller
is never left running.

## 7. Configure

`fsx.config.ts` is typed TypeScript — `satisfies AppConfig`, so the IDE completes every
field and a wrong value is a compile error:

```ts
import type { AppConfig } from 'flutter-tsx';

export default {
  name: 'my_app',
  bundleId: 'dev.fluttertsx.myapp',
  target: 'web',
} satisfies AppConfig;
```

| Field | Meaning |
| --- | --- |
| `name` | Dart package name, lower_snake_case |
| `bundleId` | Reverse-DNS application id |
| `target` | Default platform for `fsx dev` and `fsx build`: `web`, `ios`, `android`, `macos`, `windows` or `linux` |

See [config mapping](./config-mapping.md) for what fsx writes into the native projects,
and what it does not.

## 8. Build

```sh
fsx build                    # the target fsx.config.ts names
fsx build --target=macos     # or pick one
```

A platform the project has never built for is set up on the way — the SDK's desktop
support is enabled and the native folder is created — so a web-only app ships for macOS
without anyone touching native directories. The suite proves that for web and macOS; the
remaining four targets run the same code path, on toolchains this project's CI does not
have.

| Target | Artifact |
| --- | --- |
| `web` | `build/web` |
| `ios` | `build/ios/ipa` — or `build/ios/iphoneos` with `--no-codesign` |
| `android` | `build/app/outputs/bundle/release/app-release.aab` |
| `macos` | `build/macos/Build/Products/Release` |
| `windows` | `build/windows/x64/runner/Release` |
| `linux` | `build/linux/x64/release/bundle` |

## 9. Check the project

```sh
fsx doctor
```

Reports whether the SDK matches the pinned version, whether this is a project, whether
its root component exists, whether every declared plugin is installed with its typings,
and which iOS usage descriptions your `Info.plist` is still missing for the plugins you
declared — naming the fix for each, and exiting non-zero so CI can gate on it.

## Project layout

`fsx init` scaffolds this, and the starter app already uses every part of it — `App.tsx`
renders a component from `components/`, which calls a helper from `helpers/`. You are not
guessing where the second file goes.

```
my-app/
  fsx.config.ts          typed app config
  package.json           dependencies, and the "plugins" map
  tsconfig.json          strict, and wired for TSX
  src/
    App.tsx              the root component (required)
    components/          components you reuse
      Greeting.tsx
    helpers/             plain functions, no JSX
      format.tsx
  lib/                   generated Dart — never edited by hand
  .fsx/                  generated: plugin typings and extractions
  web/ macos/ …          the host Flutter app
```

Every file under `src/` compiles to the Dart file beside it: `src/components/Greeting.tsx`
becomes `lib/components/greeting.dart`, and the import between them is rewritten to match.
Directories are yours to choose — `screens/`, `features/billing/` — and nesting is free.
Name files `.tsx` even when they hold no JSX, because that is what the compiler reads.

A file does not have to export a component. One that exports only helpers, models, enums
or a store compiles to a Dart file of those, which is what makes `helpers/format.tsx`
work.

A model and a store belong in their own files too:

```
src/
  models/song.tsx        an interface, compiled to a Dart data class
  stores/playlist.tsx    a createStore, compiled to a ChangeNotifier
  NowPlaying.tsx         imports both
```

The file that declares one emits it; the file that imports it reads the shape and imports
the Dart. A store is emitted public, because a store no other file can reach is not a
shared store.

`lib/` and `.fsx/` are generated and gitignored: a fresh clone is `bun install && fsx
install`, and everything is rebuilt.

### Owning the entry point

`fsx` generates `lib/main.dart`, marked with a line saying so. Delete that line and fsx
never touches the file again — which is how an app that needs its own `main` (a menu-bar
app setting up a tray and window, say) takes over, while every component still compiles
from TSX.

## When something is not expressible

Dart cannot express everything TypeScript can. Rather than emit something subtly
different, the compiler refuses with a numbered error naming the reason and the way
round: `any` (TSX1001), `eval` (TSX1002), mapped and conditional types (TSX2002, TSX2003),
generators (TSX2006), dynamic `import()` (TSX3001), and the rest of the inventory. The
same applies inside a component: a method whose Dart counterpart behaves differently
(`slice`, `find`, `sort`) is refused rather than mapped to something that looks right and
is not.
