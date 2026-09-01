# mobile example

A field-notes app: tabs, a live camera preview, a sheet, and the keychain.

```bash
fsx init my-app --template=mobile
cd my-app && bun install && bun run dev
```

## What it shows

- Tabs — `<TabView>` becomes a Scaffold with an IndexedStack
- A live camera preview: the plugin’s own widget, rendered in TSX
- A bottom sheet from a handler
- The keychain, read with `useAsync` and written from a handler
- A store shared by all three tabs

Pub packages: `camera`, `flutter_secure_storage` — `fsx init` installs them for you.

## How it is kept honest

This directory is generated from `packages/flutter-tsx/templates/mobile`
by `bun run examples`, and a test asserts the two are byte-identical — so it
is exactly what the command above writes. Every template is transpiled,
`flutter analyze`d and built for ios on every run of the e2e
suite.
