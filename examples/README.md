# Examples

Four complete Flutter.tsx apps, one per kind of target. Each is what
`fsx init --template=<name>` writes for you, and each is transpiled,
`flutter analyze`d and built for its own platform on every run of the
end-to-end suite.

| Example | Target | What it is |
| --- | --- | --- |
| [`desktop`](desktop) | `macos` | A service console: a filtered sidebar, a details pane, and live build info. |
| [`mobile`](mobile) | `ios` | A field-notes app: tabs, a live camera preview, a sheet, and the keychain. |
| [`tray`](tray) | `macos` | A menu-bar companion: tray events, a live connectivity stream, and a status window. |
| [`web`](web) | `web` | An album browser: routes, a store every page reads, models and helpers. |

```bash
fsx init my-app --template=web
cd my-app && bun install && bun run dev
```

These directories are generated from
`packages/flutter-tsx/templates/` by `bun run examples`, and a test
asserts they match byte-for-byte — so nothing here can drift from what
the command actually produces. Edit the template, not the example.
