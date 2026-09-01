# web example

An album browser: routes, a store every page reads, models and helpers.

```bash
fsx init my-app --template=web
cd my-app && bun install && bun run dev
```

## What it shows

- Routes — `createRouter` and `useNavigation().push(…)`, wired into the app for you
- A store every page reads, with `useStore`
- Models generated from TypeScript interfaces
- Module data: `export const ALBUMS: Album[]`
- Helpers with real bodies, called from the tree

Pub packages: `go_router` — `fsx init` installs them for you.

## How it is kept honest

This directory is generated from `packages/flutter-tsx/templates/web`
by `bun run examples`, and a test asserts the two are byte-identical — so it
is exactly what the command above writes. Every template is transpiled,
`flutter analyze`d and built for web on every run of the e2e
suite.
