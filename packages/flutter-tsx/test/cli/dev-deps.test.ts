import { chmod, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { defaultDevDeps } from '@src/cli/dev';
import { defaultDev } from '@src/cli/dev-command';

const APP_TSX = `export const App = () => <Text>hi</Text>;\n`;

const CONFIG_TS = `export default {
  name: 'demo_app',
  bundleId: 'dev.fluttertsx.demo',
  target: 'web',
};
`;

const project = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), 'fsx-dev-'));
  await Bun.write(join(dir, 'fsx.config.ts'), CONFIG_TS);
  await Bun.write(join(dir, 'src', 'App.tsx'), APP_TSX);
  return dir;
};

/** A stand-in for the flutter binary, so no SDK is needed to drive the CLI. */
const stubFlutter = async (dir: string, script: string): Promise<string> => {
  const path = join(dir, 'flutter');
  await Bun.write(path, `#!/bin/sh\n${script}\n`);
  await chmod(path, 0o755);
  return path;
};

const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  label: string,
): Promise<void> => {
  const deadline = Bun.nanoseconds() + 5_000_000_000;
  while (Bun.nanoseconds() < deadline) {
    if (await condition()) return;
    await Bun.sleep(10);
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe('defaultDevDeps — build', () => {
  test('compiles the project’s components and entry point to lib/', async () => {
    const dir = await project();

    await defaultDevDeps('/unused/flutter').build(dir, {
      name: 'Demo',
      bundleId: 'dev.fluttertsx.demo',
      target: 'web',
    });

    expect(await Bun.file(join(dir, 'lib', 'app.dart')).text()).toBe(
      `import 'package:flutter/material.dart';

class App extends StatelessWidget {
  const App({super.key});

  @override
  Widget build(BuildContext context) {
    return const Text('hi');
  }
}
`,
    );
    expect(await Bun.file(join(dir, 'lib', 'main.dart')).text()).toContain(
      "title: 'Demo',",
    );

    await rm(dir, { recursive: true, force: true });
  }, 60000);
});

describe('defaultDevDeps — startFlutter', () => {
  test('runs the binary and forwards a hot reload keystroke', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-stub-'));
    const keystroke = join(dir, 'keystroke');
    const flutter = await stubFlutter(dir, `head -c 1 > ${keystroke}`);

    const session = defaultDevDeps(flutter).startFlutter(['run'], dir);
    session.reload();

    expect(await session.exited).toBe(0);
    expect(await Bun.file(keystroke).text()).toBe('r');

    await rm(dir, { recursive: true, force: true });
  }, 60000);

  test('stops a running session', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-stub-'));
    const flutter = await stubFlutter(dir, 'sleep 30');

    const session = defaultDevDeps(flutter).startFlutter(['run'], dir);
    session.stop();

    expect(await session.exited).not.toBe(0);

    await rm(dir, { recursive: true, force: true });
  }, 60000);
});

describe('defaultDevDeps — watch', () => {
  test('reports saved components and ignores everything else', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'fsx-watch-'));
    await Bun.write(join(dir, 'keep.txt'), 'x');
    const changed: string[] = [];

    const stop = defaultDevDeps('/unused/flutter').watch(dir, (path) => {
      changed.push(path);
    });

    // fs.watch arms asynchronously, so the write is repeated until the
    // watcher reports rather than raced against once.
    await waitFor(async () => {
      await Bun.write(join(dir, 'ignored.txt'), 'y');
      await Bun.write(join(dir, 'App.tsx'), APP_TSX);
      await Bun.sleep(20);
      return changed.length > 0;
    }, 'a component change');
    stop();

    expect(changed.every((path) => path.endsWith('.tsx'))).toBe(true);
    expect(changed).toContain(join(dir, 'App.tsx'));

    await rm(dir, { recursive: true, force: true });
  }, 60000);
});

describe('defaultDevDeps — out', () => {
  test('writes a line to stdout', () => {
    const lines: string[] = [];
    const write = process.stdout.write.bind(process.stdout);
    process.stdout.write = (chunk: string): boolean => {
      lines.push(chunk);
      return true;
    };
    try {
      defaultDevDeps('/unused/flutter').out('hello');
    } finally {
      process.stdout.write = write;
    }

    expect(lines).toEqual(['hello\n']);
  });
});

describe('defaultDev', () => {
  const withStubSdk = async (
    script: string,
    body: (dir: string) => Promise<void> | void,
  ): Promise<void> => {
    const home = await mkdtemp(join(tmpdir(), 'fsx-dev-home-'));
    const binDir = join(home, 'flutter', 'bin');
    await stubFlutter(binDir, script);
    const previous = process.env.FSX_HOME;
    process.env.FSX_HOME = home;
    const dir = await project();
    try {
      await body(dir);
    } finally {
      if (previous === undefined) delete process.env.FSX_HOME;
      else process.env.FSX_HOME = previous;
      await rm(home, { recursive: true, force: true });
      await rm(dir, { recursive: true, force: true });
    }
  };

  test('builds and runs the app through the installed SDK', async () => {
    await withStubSdk('exit 0', async (dir) => {
      await defaultDev(dir);

      expect(await Bun.file(join(dir, 'lib', 'main.dart')).exists()).toBe(true);
    });
  }, 60000);

  test('reports the code a failing run exited with', async () => {
    await withStubSdk('exit 3', (dir) => {
      expect(defaultDev(dir)).rejects.toThrow('flutter run exited with 3.');
    });
  }, 60000);
});
