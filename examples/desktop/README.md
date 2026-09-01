# desktop example

A service console: a filtered sidebar, a details pane, and live build info.

```bash
fsx init my-app --template=desktop
cd my-app && bun install && bun run dev
```

## What it shows

- A master–detail window: a filtered sidebar and a details pane
- A store the two panes share
- Live build information from `usePackageInfo`
- Opening links with `launchUrl`
- An `<Animated>` panel and colours written as `#rrggbb`

Pub packages: `package_info_plus`, `url_launcher` — `fsx init` installs them for you.

## How it is kept honest

This directory is generated from `packages/flutter-tsx/templates/desktop`
by `bun run examples`, and a test asserts the two are byte-identical — so it
is exactly what the command above writes. Every template is transpiled,
`flutter analyze`d and built for macos on every run of the e2e
suite.
