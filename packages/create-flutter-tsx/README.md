# create-flutter-tsx

**Scaffold a Flutter.tsx app — write TSX, ship Flutter.**

> **Not on npm yet** — this is what `npm create flutter-tsx@latest my-app` will run
> once 1.0 ships. Until then, scaffold from a clone with
> `bun packages/flutter-tsx/bin/fsx.ts init my-app`, which does exactly the same thing.
>
> **[Bun](https://bun.sh) is required.** npm starts this command and Bun finishes it:
> the compiler, the CLI and the project it scaffolds all run on Bun. Without it the
> command says so, and how to install it.

```sh
npm create flutter-tsx@latest my-app   # or: bun create flutter-tsx my-app
cd my-app

fsx install
fsx dev
```

You get a typed `fsx.config.ts`, a `src/App.tsx` to start from, a `tsconfig.json` wired
for TSX, and the host Flutter app — ready to run on web, iOS, Android, macOS, Windows or
Linux.

Everything this does is `fsx init` from [`flutter-tsx`](../flutter-tsx), so a project
created here and one created by the CLI are the same project.

See the [guide](../../docs/guide.md) for what to do next.

## License

MIT © Paul Engel
