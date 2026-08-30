import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';
import {
  defaultDevDeps,
  defaultInitDeps,
  loadAppConfig,
  runInitCommand,
} from 'flutter-tsx/cli';

import { buildWeb, dartBin, flutterBin, run } from './support/flutter-app';

const APP = `import { Center, Column } from 'flutter-tsx';

import { UserCard } from './components/UserCard';
import { Banner } from './Banner';

export const App = () => (
  <Center>
    <Column>
      <Banner title="Team" />
      <UserCard name="Ada" admin={true} />
    </Column>
  </Center>
);
`;

const USER_CARD = `import { Column, Text } from 'flutter-tsx';

export const UserCard = ({ name, admin }: { name: string; admin: boolean }) => (
  <Column>
    <Text>{name}</Text>
    <Text>{admin ? 'admin' : 'member'}</Text>
  </Column>
);
`;

const BANNER = `import { Text } from 'flutter-tsx';

export const Banner = ({ title }: { title: string }) => <Text>{title}</Text>;
`;

/**
 * A project of several components across directories: each compiles to its
 * own Dart file, importing the files that declare the components it renders.
 */
describe('a multi-file project', () => {
  test('compiles every component, wires the imports and builds', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'fsx-multi-'));
    const appDir = join(parent, 'multi-app');

    await runInitCommand(appDir, {
      ...defaultInitDeps(),
      out: () => undefined,
    });
    await Bun.write(join(appDir, 'src', 'App.tsx'), APP);
    await Bun.write(join(appDir, 'src', 'Banner.tsx'), BANNER);
    await Bun.write(
      join(appDir, 'src', 'components', 'UserCard.tsx'),
      USER_CARD,
    );

    const config = await loadAppConfig(appDir);
    const built = await defaultDevDeps({ flutterBin, dartBin }).build(
      appDir,
      config,
    );

    // This project's own files, plus the two the scaffold ships: every file
    // under src/ compiles, whether or not this test's App renders it.
    expect(built).toEqual([
      'app.dart',
      'banner.dart',
      'components/greeting.dart',
      'components/user_card.dart',
      'helpers/format.dart',
    ]);

    // The root imports both components it renders — one of them nested.
    const appDart = await Bun.file(join(appDir, 'lib', 'app.dart')).text();
    expect(appDart).toContain("import 'banner.dart';");
    expect(appDart).toContain("import 'components/user_card.dart';");
    expect(appDart).toContain("UserCard(name: 'Ada', admin: true)");

    // Everything the build wrote is canonically formatted.
    const formatted = await run(
      [dartBin, 'format', '--set-exit-if-changed', join(appDir, 'lib')],
      appDir,
    );
    expect(formatted.exitCode).toBe(0);

    await rm(join(appDir, 'test'), { recursive: true, force: true });

    const analyzed = await run([flutterBin, 'analyze', '--no-pub'], appDir);
    expect(analyzed.exitCode).toBe(0);

    const build = await buildWeb(appDir);
    expect(build.exitCode).toBe(0);

    await rm(parent, { recursive: true, force: true });
  }, 900000);
});
