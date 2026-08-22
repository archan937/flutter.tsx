# Guide — working with flutter-tsx

Write your app in TSX; `fsx` transpiles it to idiomatic Dart and drives Flutter. You never write Dart by hand, and one codebase ships to all six targets (web · iOS · Android · macOS · Windows · Linux).

## 1. Scaffold

```sh
bun create flutter-tsx my-app   # interactive: target → app kind
cd my-app && bun install
```

You get a typed `config/`, a skeleton `src/App.tsx`, brand `icons/`, `locales/`, and tooling. See [`create-flutter-tsx`](../../create-flutter-tsx/README.md) for the skeleton catalog.

## 2. Develop

```sh
bun run dev            # fsx dev — uses config/app.ts target
bun run dev:ios        # or pick a target explicitly
```

`fsx dev` scaffolds the Flutter project under `.fsx/flutter/`, transpiles `src/**/*.tsx` → Dart, applies your config surfaces (theme, permissions, links, locales), and runs Flutter with hot-reload on save.

## 3. Configure

Config is **typed TypeScript** (`satisfies` a type from `flutter-tsx/config`) — autocomplete + compile-time checks, no native conventions to memorize.

- **Cross-platform** values live once and fan out: `config/app.ts` (identity), `config/theme.ts`, `config/links.ts`, `config/permissions.ts` (usually unneeded — permissions are inferred from hooks), `config/env.ts`.
- **OS-specific** bits go in `config/platforms/<os>.ts` (signing, `deploymentTarget`, FCM).

See **[config-mapping.md](./config-mapping.md)** for exactly which native files each key produces, per platform.

## 4. Routing (multi-screen)

File-based, like Next.js / Expo Router — the `src/routes/` tree **is** the route map:

```
src/routes/
  index.tsx          →  /
  about.tsx          →  /about
  users/[id].tsx     →  /users/:id     ([brackets] = dynamic param)
```

Point your `MaterialApp` at the directory — this is the visible connection that turns routing on:

```tsx
// src/App.tsx
import { MaterialApp } from 'flutter-tsx';
export const MainApp = () => <MaterialApp title="My App" routes="./routes" />;
```

Each route file exports one screen component. fsx generates a `go_router` config from `src/routes/`, rewrites that `<MaterialApp>` to `MaterialApp.router(...)`, and adds the `go_router` dependency. (The `routes` prop is repurposed as the routes directory — file-based routing supersedes Flutter's manual routes map.) Navigate imperatively:

```tsx
import { useNavigate } from 'flutter-tsx';
const nav = useNavigate();
nav.push('/users/42'); // context.push
nav.go('/about'); // context.go
nav.pop(); // context.pop
```

Read a route param inside a screen with `useParams`:

```tsx
import { useParams } from 'flutter-tsx';
const id = useParams('id'); // on /users/[id] → GoRouterState path param
return <Text>User {id}</Text>;
```

No routes prop / directory → your app stays a single screen (`MaterialApp(home: …)`), zero router overhead.

## 5. State management

Define a shared store (Zustand-style) — state + actions in one factory. fsx
generates an idiomatic `ChangeNotifier`, provides it at the app root, and adds
the `provider` dependency automatically:

```tsx
// src/stores/counter.tsx
import { createStore } from 'flutter-tsx';

type CounterState = { count: number; increment: () => void };

export const useCounter = createStore<CounterState>((set) => ({
  count: 0,
  increment: () => set((s) => ({ count: s.count + 1 })),
}));
```

> Pass the state type explicitly — TS can't infer a store whose actions read
> state (same as Zustand's `create<T>()`), so `createStore<State>(...)` is the
> type-safe form.

Use it in any screen — destructure like React. Reads become `context.watch`, and
actions are bound calls:

```tsx
import { useCounter } from '../stores/counter';

export const Screen = () => {
  const { count, increment } = useCounter();
  return (
    <ElevatedButton onClick={increment}>
      <Text>{count}</Text>
    </ElevatedButton>
  );
};
```

Stores resolve across files; the `ChangeNotifierProvider`s are wired into
`main.dart` for you.

## 6. Async data & `fetch`

`useAsync` runs a future and exposes `{ data, loading, error }` — it compiles to
a `FutureBuilder`. `fetch()` is a built-in HTTP source (over the `http` package)
that composes with it:

```tsx
import {
  useAsync,
  fetch,
  Center,
  CircularProgressIndicator,
  Text,
} from 'flutter-tsx';

export const Feed = () => {
  const { data, loading, error } = useAsync(() =>
    fetch('https://api.example.com/posts'),
  );
  if (loading)
    return (
      <Center>
        <CircularProgressIndicator />
      </Center>
    );
  if (error)
    return (
      <Center>
        <Text>Something went wrong</Text>
      </Center>
    );
  return <Text>{data.body}</Text>; // also: data.ok, data.status, data.json
};
```

The loading branch maps to the not-done connection state, the error branch to
`snapshot.hasError`, and `data` binds from `snapshot.data!`.

## 7. Tabs & modals

`<TabView>` is a bottom-navigation shell (Scaffold + `BottomNavigationBar` +
`IndexedStack`, so tab state is preserved):

```tsx
import { TabView } from 'flutter-tsx';

<TabView
  tabs={[
    { label: 'Home', icon: 'home', screen: <HomeScreen /> },
    { label: 'Profile', icon: 'person', screen: <ProfileScreen /> },
  ]}
/>;
```

Modals are imperative (they map 1:1 to Flutter) — call them from a handler:

```tsx
import { showSheet, showDialog } from 'flutter-tsx';

<ElevatedButton onClick={() => showSheet(<CartView />)}>Cart</ElevatedButton>
<ElevatedButton onClick={() => showDialog(<ConfirmDelete />)}>Delete</ElevatedButton>
```

## 8. Gestures & animation

Tap handlers work on **any** widget — `onTap`, `onDoubleTap`, and `onLongPress`.
If the widget supports them natively (e.g. `GestureDetector`, `InkWell`) they
pass straight through; otherwise fsx wraps it in a `GestureDetector` for you:

```tsx
<Container onTap={() => select(id)} onLongPress={() => remove(id)}>
  <Text>{label}</Text>
</Container>
// → GestureDetector(onTap: …, onLongPress: …, child: Container(…))
```

Add `animate` to an animatable widget and its prop changes tween automatically —
fsx swaps it for the matching `Animated*` widget. `duration` is milliseconds
(default 300) and `curve` is a named curve:

```tsx
<Container
  animate
  duration={300}
  curve="easeInOut"
  width={open ? 240 : 120}
  color={open ? 'blue' : 'grey'}
  onTap={() => setOpen(!open)}
/>
// → AnimatedContainer(duration: Duration(milliseconds: 300),
//      curve: Curves.easeInOut, width: …, color: open ? Colors.blue : Colors.grey, …)
```

Animatable widgets: `Container`, `Opacity`, `Align`, `Padding`, `Positioned`,
`DefaultTextStyle`, `FractionallySizedBox`.

## 9. Native functions

Call a native capability directly — fsx transpiles it to the underlying plugin
call and adds the pubspec dependency automatically:

```tsx
import {
  launchUrl,
  share,
  pickFile,
  clipboard,
  hapticFeedback,
} from 'flutter-tsx';

await launchUrl('https://flutter.dev'); // → url_launcher
await share('Check this out', 'Subject'); // → share_plus
await clipboard.copy('copied'); // → Clipboard.setData
await hapticFeedback.light(); // → HapticFeedback.lightImpact
const file = await pickFile({ extensions: ['pdf'] }); // → file_picker
```

Also available: `clipboard.paste`, `hapticFeedback.{medium,heavy,vibrate}`,
`systemChrome.{setOrientation,setStatusBarColor}`, `loadAsset(path)`,
`appDir()` / `tempDir()`. Use them inside a handler (`onClick`, `useEffect`).

## 10. System-tray / menubar apps (desktop)

Add a `config/tray.ts` to turn a desktop app into a tray/menubar app — fsx emits
the `window_manager` + `tray_manager` bootstrap (tray icon, context menu, and
Show/Hide/Quit wiring) into `main.dart`; your TSX is just the window UI. The
menubar icon comes from `icons/tray.png` (a small monochrome glyph), falling
back to `icons/icon.png` when absent:

```ts
// config/tray.ts
import type { TrayConfig } from 'flutter-tsx/config';

export default {
  tooltip: 'My App',
  menu: [
    { label: 'Show', action: 'show' },
    { label: 'Hide', action: 'hide' },
    { label: 'Quit', action: 'quit' },
  ],
} satisfies TrayConfig;
```

## 11. Build & sign

```sh
bun run build              # fsx build — release artifact for config/app.ts target
bun run build:macos        # or a specific target
```

`fsx build` is the non-interactive path (transpile → apply surfaces → `flutter build <target>`, exits with the build's code). Signing is driven by `config/platforms/<os>.ts`:

- **android** → `key.properties` from a keystore (password via env var).
- **macos** → `codesign` + notarize (Developer ID + Apple notary).
- **windows** → Authenticode `signtool`.

Credential files live in a **gitignored `signing/<os>/`** directory, referenced by path from the platform config; passwords come from environment variables, never source.

## CLI reference

| command                | does                                                    |
| ---------------------- | ------------------------------------------------------- |
| `fsx install`          | download the Flutter SDK to `~/.fsx/flutter/`           |
| `fsx init`             | scaffold a minimal project (`config/app.ts` + `src/`)   |
| `fsx dev [--target]`   | watch + transpile + run Flutter with hot-reload         |
| `fsx build [--target]` | transpile + `flutter build` a release artifact (+ sign) |
