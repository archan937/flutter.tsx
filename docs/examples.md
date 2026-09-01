# Examples

Four complete apps, one per kind of target. Each is a starting point
`fsx init` writes for you, and each is transpiled, analysed and built by
the end-to-end suite on every run — so what you read here is what
compiles.

```bash
fsx init my-app --template=<desktop|mobile|tray|web>
```

## desktop

A service console: a filtered sidebar, a details pane, and live build info.

```bash
fsx init my-app --template=desktop
cd my-app && bun install && bun run dev
```

### What it shows

- A master–detail window: a filtered sidebar and a details pane
- A store the two panes share
- Live build information from `usePackageInfo`
- Opening links with `launchUrl`
- An `<Animated>` panel and colours written as `#rrggbb`

Pub packages: `package_info_plus`, `url_launcher` — `fsx init` adds and installs them.

### The files it writes

- `src/App.tsx`
- `src/components/AboutBar.tsx`
- `src/components/ServiceDetail.tsx`
- `src/components/ServiceRow.tsx`
- `src/components/Sidebar.tsx`
- `src/components/StatusChip.tsx`
- `src/data/services.tsx`
- `src/helpers/format.tsx`
- `src/models/service.tsx`
- `src/stores/console.tsx`

Built for `macos` on every run of the end-to-end suite, and committed under [`examples/desktop`](https://github.com/archan937/flutter.tsx/tree/master/examples/desktop).

## mobile

A field-notes app: tabs, a live camera preview, a sheet, and the keychain.

```bash
fsx init my-app --template=mobile
cd my-app && bun install && bun run dev
```

### What it shows

- Tabs — `<TabView>` becomes a Scaffold with an IndexedStack
- A live camera preview: the plugin’s own widget, rendered in TSX
- A bottom sheet from a handler
- The keychain, read with `useAsync` and written from a handler
- A store shared by all three tabs

Pub packages: `camera`, `flutter_secure_storage` — `fsx init` adds and installs them.

### The files it writes

- `src/App.tsx`
- `src/components/NoteCard.tsx`
- `src/data/notes.tsx`
- `src/helpers/format.tsx`
- `src/models/note.tsx`
- `src/stores/notebook.tsx`
- `src/tabs/CaptureTab.tsx`
- `src/tabs/NotesTab.tsx`
- `src/tabs/VaultTab.tsx`

Built for `ios` on every run of the end-to-end suite, and committed under [`examples/mobile`](https://github.com/archan937/flutter.tsx/tree/master/examples/mobile).

## tray

A menu-bar companion: tray events, a live connectivity stream, and a status window.

```bash
fsx init my-app --template=tray
cd my-app && bun install && bun run dev
```

### What it shows

- Tray events: writing a callback registers the listener for you
- A live connectivity stream with `useStream`
- A mount effect that talks to the plugin
- A store the tray and the window share
- Opening links with `launchUrl`

Pub packages: `connectivity_plus`, `tray_manager`, `url_launcher` — `fsx init` adds and installs them.

### The files it writes

- `src/App.tsx`
- `src/components/CheckRow.tsx`
- `src/components/ConnectionBadge.tsx`
- `src/data/checks.tsx`
- `src/helpers/format.tsx`
- `src/models/check.tsx`
- `src/stores/status.tsx`

Built for `macos` on every run of the end-to-end suite, and committed under [`examples/tray`](https://github.com/archan937/flutter.tsx/tree/master/examples/tray).

## web

An album browser: routes, a store every page reads, models and helpers.

```bash
fsx init my-app --template=web
cd my-app && bun install && bun run dev
```

### What it shows

- Routes — `createRouter` and `useNavigation().push(…)`, wired into the app for you
- A store every page reads, with `useStore`
- Models generated from TypeScript interfaces
- Module data: `export const ALBUMS: Album[]`
- Helpers with real bodies, called from the tree

Pub packages: `go_router` — `fsx init` adds and installs them.

### The files it writes

- `src/components/AlbumCard.tsx`
- `src/components/SearchField.tsx`
- `src/data/albums.tsx`
- `src/helpers/format.tsx`
- `src/models/album.tsx`
- `src/pages/AlbumPage.tsx`
- `src/pages/LibraryPage.tsx`
- `src/routes.tsx`
- `src/stores/library.tsx`

Built for `web` on every run of the end-to-end suite, and committed under [`examples/web`](https://github.com/archan937/flutter.tsx/tree/master/examples/web).
