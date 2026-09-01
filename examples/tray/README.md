# tray example

A menu-bar companion: tray events, a live connectivity stream, and a status window.

```bash
fsx init my-app --template=tray
cd my-app && bun install && bun run dev
```

## What it shows

- Tray events: writing a callback registers the listener for you
- A live connectivity stream with `useStream`
- A mount effect that talks to the plugin
- A store the tray and the window share
- Opening links with `launchUrl`

Pub packages: `connectivity_plus`, `tray_manager`, `url_launcher` — `fsx init` installs them for you.

## How it is kept honest

This directory is generated from `packages/flutter-tsx/templates/tray`
by `bun run examples`, and a test asserts the two are byte-identical — so it
is exactly what the command above writes. Every template is transpiled,
`flutter analyze`d and built for macos on every run of the e2e
suite.
