import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'bun:test';

import { transpileComponent } from '@src/compiler/transpile';

const HELLO_SOURCE = `import { Center, Column, Text } from 'flutter-tsx';

export const HelloScreen = () => (
  <Column mainAxisAlignment="center">
    <Text>Hello Flutter.tsx</Text>
    <Center>
      <Text>It works!</Text>
    </Center>
  </Column>
);
`;

const HELLO_DART = `import 'package:flutter/material.dart';

class HelloScreen extends StatelessWidget {
  const HelloScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Hello Flutter.tsx'),
        Center(child: Text('It works!')),
      ],
    );
  }
}
`;

describe('transpileComponent — stateless components', () => {
  test('emits the complete Dart file', async () => {
    expect(
      await transpileComponent({ source: HELLO_SOURCE, filePath: 'hello.tsx' }),
    ).toBe(HELLO_DART);
  });

  test('cupertino-only widgets import just the cupertino library', async () => {
    expect(
      await transpileComponent({
        source:
          "import { Center, CupertinoActivityIndicator } from 'flutter-tsx';\n" +
          'export const Spinner = () => (\n' +
          '  <Center>\n' +
          '    <CupertinoActivityIndicator />\n' +
          '  </Center>\n' +
          ');\n',
        filePath: 'spinner.tsx',
      }),
    ).toBe(
      `import 'package:flutter/cupertino.dart';

class Spinner extends StatelessWidget {
  const Spinner({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: CupertinoActivityIndicator());
  }
}
`,
    );
  });

  test('mixed material and cupertino widgets import both libraries', async () => {
    expect(
      await transpileComponent({
        source:
          "import { Card, CupertinoActivityIndicator } from 'flutter-tsx';\n" +
          'export const MixedScreen = () => (\n' +
          '  <Card>\n' +
          '    <CupertinoActivityIndicator />\n' +
          '  </Card>\n' +
          ');\n',
        filePath: 'mixed.tsx',
      }),
    ).toBe(
      `import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class MixedScreen extends StatelessWidget {
  const MixedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Card(child: CupertinoActivityIndicator());
  }
}
`,
    );
  });
  test('names no barrel re-exports pull in their defining library', async () => {
    expect(
      await transpileComponent({
        source:
          "import { SensitiveContent, Text } from 'flutter-tsx';\n" +
          'export const Sensitive = () => (\n' +
          '  <SensitiveContent sensitivity="autoSensitive">\n' +
          '    <Text>hi</Text>\n' +
          '  </SensitiveContent>\n' +
          ');\n',
        filePath: 'sensitive.tsx',
      }),
    ).toBe(
      `import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

class Sensitive extends StatelessWidget {
  const Sensitive({super.key});

  @override
  Widget build(BuildContext context) {
    return const SensitiveContent(
      sensitivity: ContentSensitivity.autoSensitive,
      child: Text('hi'),
    );
  }
}
`,
    );
  });
});

describe('transpileComponent — stateful components', () => {
  test('useState and a named handler emit the full StatefulWidget', async () => {
    const source = await Bun.file(
      new URL('../fixtures/05-counter/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/05-counter/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'counter.tsx' })).toBe(
      expected,
    );
  });

  test('mount effects, ternaries, and inline handlers emit in full', async () => {
    const source = await Bun.file(
      new URL('../fixtures/06-mount-effect/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/06-mount-effect/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'status.tsx' })).toBe(
      expected,
    );
  });

  test('list rendering emits a collection-for', async () => {
    const source = await Bun.file(
      new URL('../fixtures/07-list-rendering/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/07-list-rendering/expected.dart', import.meta.url),
    ).text();

    expect(
      await transpileComponent({ source, filePath: 'groceries.tsx' }),
    ).toBe(expected);
  });

  test('user components compose with typed constructor props', async () => {
    const source = await Bun.file(
      new URL('../fixtures/08-composition/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/08-composition/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'welcome.tsx' })).toBe(
      expected,
    );
  });

  test('a stateful component reads its props through the widget', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = ({ label }: { label: string }) => {\n' +
        '  const [count, setCount] = useState(0);\n' +
        '  return <Text onClick={() => setCount(count + 1)}>{label}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toBe(`import 'package:flutter/material.dart';

class Probe extends StatefulWidget {
  const Probe({super.key, required this.label});

  final String label;

  @override
  State<Probe> createState() => _ProbeState();
}

class _ProbeState extends State<Probe> {
  int _count = 0;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => setState(() => _count++),
      child: Text(widget.label),
    );
  }
}
`);
  });

  test('named prop types, fragments, and final fields emit in full', async () => {
    const source = await Bun.file(
      new URL('../fixtures/09-typed-props/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/09-typed-props/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'tasks.tsx' })).toBe(
      expected,
    );
  });

  test('async handlers become async methods', async () => {
    expect(
      await transpileComponent({
        source:
          "import { ElevatedButton, useState } from 'flutter-tsx';\n" +
          'export const Saver = () => {\n' +
          '  const [saved, setSaved] = useState(false);\n' +
          '  const save = async () => {\n' +
          '    setSaved(true);\n' +
          '  };\n' +
          '  return <ElevatedButton onClick={save}>Save</ElevatedButton>;\n' +
          '};\n',
        filePath: 'saver.tsx',
      }),
    ).toBe(
      `import 'package:flutter/material.dart';

class Saver extends StatefulWidget {
  const Saver({super.key});

  @override
  State<Saver> createState() => _SaverState();
}

class _SaverState extends State<Saver> {
  bool _saved = false;

  Future<void> _save() async {
    setState(() {
      _saved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(onPressed: _save, child: const Text('Save'));
  }
}
`,
    );
  });
});

describe('transpileComponent — plugins', () => {
  test('the camera conformance fixture emits its certified golden', async () => {
    const source = await Bun.file(
      new URL('../fixtures/01-camera-screen/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/01-camera-screen/expected.dart', import.meta.url),
    ).text();

    expect(
      await transpileComponent({ source, filePath: 'camera_screen.tsx' }),
    ).toBe(expected);
  });

  test('a plugin call inline in a gesture handler compiles', async () => {
    const source = await Bun.file(
      new URL('../fixtures/27-inline-plugin-call/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL(
        '../fixtures/27-inline-plugin-call/expected.dart',
        import.meta.url,
      ),
    ).text();

    expect(
      await transpileComponent({ source, filePath: 'inline_link.tsx' }),
    ).toBe(expected);
  });

  test('hook options override the derived defaults', async () => {
    const source = await Bun.file(
      new URL('../fixtures/10-camera-options/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/10-camera-options/expected.dart', import.meta.url),
    ).text();

    expect(
      await transpileComponent({ source, filePath: 'hi_res_camera.tsx' }),
    ).toBe(expected);
  });

  test('singleton services derive with zero hand data', async () => {
    const source = await Bun.file(
      new URL('../fixtures/11-preferences/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/11-preferences/expected.dart', import.meta.url),
    ).text();

    expect(await transpileComponent({ source, filePath: 'profile.tsx' })).toBe(
      expected,
    );
  });

  test('an unextracted plugin is a loud error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          "import { useRocket } from 'plugin:rocketry';\n" +
          'export const Probe = () => {\n' +
          '  const rocket = useRocket();\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        `no extracted API for rocketry — add it to the "plugins" map in ` +
          'package.json and run `fsx install`.',
      ),
    );
  });
});
// A store wide enough to overflow 80 columns takes the tall form on both its
// constructor and its update signature — the same rule as any Dart call.
describe('transpileComponent — components from sibling files', () => {
  test('imports the file declaring an imported component', async () => {
    const source = await Bun.file(
      new URL('../fixtures/28-multi-file/input.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/28-multi-file/expected.dart', import.meta.url),
    ).text();
    const filePath = new URL(
      '../fixtures/28-multi-file/input.tsx',
      import.meta.url,
    ).pathname;

    expect(await transpileComponent({ source, filePath })).toBe(expected);
  });

  test('compiles the imported component to its own golden', async () => {
    const source = await Bun.file(
      new URL('../fixtures/28-multi-file/UserCard.tsx', import.meta.url),
    ).text();
    const expected = await Bun.file(
      new URL('../fixtures/28-multi-file/user_card.dart', import.meta.url),
    ).text();
    const filePath = new URL(
      '../fixtures/28-multi-file/UserCard.tsx',
      import.meta.url,
    ).pathname;

    expect(await transpileComponent({ source, filePath })).toBe(expected);
  });

  test('resolves a component imported from a parent directory', async () => {
    const filePath = new URL(
      '../fixtures/28-multi-file/routes/Listing.tsx',
      import.meta.url,
    ).pathname;

    const dart = await transpileComponent({
      source:
        "import { UserCard } from '../UserCard';\n\n" +
        'export const Listing = () => <UserCard name="Ada" admin={true} />;\n',
      filePath,
    });

    expect(dart).toContain("import '../user_card.dart';");
  });

  test('hides the Flutter widget an imported component shadows', async () => {
    const filePath = new URL(
      '../fixtures/28-multi-file/input.tsx',
      import.meta.url,
    ).pathname;

    const dart = await transpileComponent({
      source:
        "import { Banner } from './Banner';\n\n" +
        'export const Shell = () => <Banner title="Team" />;\n',
      filePath,
    });

    // Flutter also exports `Banner`; without the hide, Dart cannot tell the
    // two apart and the file does not compile.
    expect(dart).toBe(
      `import 'package:flutter/material.dart' hide Banner;

import 'banner.dart';

class Shell extends StatelessWidget {
  const Shell({super.key});

  @override
  Widget build(BuildContext context) {
    return const Banner(title: 'Team');
  }
}
`,
    );
  });

  test('reports an import that names no file', () => {
    const filePath = new URL(
      '../fixtures/28-multi-file/input.tsx',
      import.meta.url,
    ).pathname;

    expect(
      transpileComponent({
        source:
          "import { Missing } from './Missing';\n\n" +
          'export const Broken = () => <Missing />;\n',
        filePath,
      }),
    ).rejects.toThrow(
      /TSX0336 .* <Missing \/> is imported from '\.\/Missing', but .*Missing\.tsx does not exist\./,
    );
  });

  test('reports a file that declares no such component', () => {
    const filePath = new URL(
      '../fixtures/28-multi-file/input.tsx',
      import.meta.url,
    ).pathname;

    expect(
      transpileComponent({
        source:
          "import { Absent } from './UserCard';\n\n" +
          'export const Broken = () => <Absent />;\n',
        filePath,
      }),
    ).rejects.toThrow(/TSX0336 .* exports no component named Absent\./);
  });

  test('leaves a relative import alone when its name is never rendered', async () => {
    const filePath = new URL(
      '../fixtures/28-multi-file/input.tsx',
      import.meta.url,
    ).pathname;

    expect(
      await transpileComponent({
        source:
          "import { formatName } from './helpers';\n\n" +
          'export const Plain = () => <Text>{formatName}</Text>;\n',
        filePath,
      }),
    ).toContain("import 'package:flutter/material.dart';");
  });
});

describe('transpileComponent — a store that must wrap', () => {
  test('splits the constructor and update params one per line', async () => {
    const source =
      "import { Text, createStore, useStore } from 'flutter-tsx';\n" +
      'const settingsStore = createStore({\n' +
      "  firstUserFacingLabel: 'one',\n" +
      "  secondUserFacingLabel: 'two',\n" +
      "  thirdUserFacingLabel: 'three',\n" +
      '});\n' +
      'export const Settings = () => {\n' +
      '  const [state, setState] = useStore(settingsStore);\n' +
      '  return <Text>{state.firstUserFacingLabel}</Text>;\n' +
      '};\n';

    expect(await transpileComponent({ source, filePath: 'settings.tsx' }))
      .toBe(`import 'package:flutter/material.dart';

class SettingsStore extends ChangeNotifier {
  SettingsStore({
    required this.firstUserFacingLabel,
    required this.secondUserFacingLabel,
    required this.thirdUserFacingLabel,
  });

  String firstUserFacingLabel;
  String secondUserFacingLabel;
  String thirdUserFacingLabel;

  void update({
    String? firstUserFacingLabel,
    String? secondUserFacingLabel,
    String? thirdUserFacingLabel,
  }) {
    if (firstUserFacingLabel != null) {
      this.firstUserFacingLabel = firstUserFacingLabel;
    }
    if (secondUserFacingLabel != null) {
      this.secondUserFacingLabel = secondUserFacingLabel;
    }
    if (thirdUserFacingLabel != null) {
      this.thirdUserFacingLabel = thirdUserFacingLabel;
    }
    notifyListeners();
  }
}

final SettingsStore settingsStore = SettingsStore(
  firstUserFacingLabel: 'one',
  secondUserFacingLabel: 'two',
  thirdUserFacingLabel: 'three',
);

class Settings extends StatelessWidget {
  const Settings({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: settingsStore,
      builder: (context, child) {
        return Text(settingsStore.firstUserFacingLabel);
      },
    );
  }
}
`);
  });
});
// A route too wide for one line splits exactly the way dart format splits it
// (verified against the formatter, not assumed).
describe('transpileComponent — a route that must wrap', () => {
  test('splits the GoRoute across lines', async () => {
    const source =
      "import { Text, createRouter } from 'flutter-tsx';\n" +
      'export const SettingsAndPreferencesPage = () => <Text>Settings</Text>;\n' +
      'export const router = createRouter({\n' +
      "  '/settings-and-preferences': SettingsAndPreferencesPage,\n" +
      '});\n';

    expect(await transpileComponent({ source, filePath: 'routes.tsx' }))
      .toBe(`import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class SettingsAndPreferencesPage extends StatelessWidget {
  const SettingsAndPreferencesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return const Text('Settings');
  }
}

final GoRouter router = GoRouter(
  routes: [
    GoRoute(
      path: '/settings-and-preferences',
      builder: (context, state) => const SettingsAndPreferencesPage(),
    ),
  ],
);
`);
  });
});
// The model can be named by the annotation (idiomatic TypeScript) or by an
// explicit type argument; both decode through the generated class.
describe('transpileComponent — json models', () => {
  const source = (local: string): string =>
    "import { Text, json, useAsync } from 'flutter-tsx';\n" +
    "import { get } from 'plugin:http';\n" +
    'interface Album {\n  title: string;\n}\n' +
    'export const Probe = async () => {\n' +
    "  const res = await useAsync(() => get('https://x.test/a'), {\n" +
    '    loading: () => <Text>…</Text>,\n' +
    '    error: (err) => <Text>{err}</Text>,\n' +
    '  });\n' +
    local +
    '  return <Text>{album.title}</Text>;\n' +
    '};\n';

  // `as` is how TypeScript normally types a parsed body, and `json` returns
  // `unknown` so the cast is the only way to name the model.
  test('the cast names the model that decodes the body', async () => {
    const annotated = await transpileComponent({
      source: source('  const album = json(res.body) as Album;\n'),
      filePath: 'probe.tsx',
    });

    expect(annotated).toContain(
      '        final album = Album.fromJson(\n' +
        '          jsonDecode(res.body) as Map<String, dynamic>,\n' +
        '        );',
    );
  });

  // At 82 columns this factory cannot fit on one line, so dart format breaks
  // after the arrow and keeps the body whole — verified against the formatter.
  test('a factory too wide for one line breaks after the arrow', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, json } from 'flutter-tsx';\n" +
        'interface Tag {\n  id: string;\n}\n' +
        'export const Probe = () => {\n' +
        '  const tag = json(raw) as Tag;\n' +
        '  return <Text>{tag.id}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      '  factory Tag.fromJson(Map<String, dynamic> json) =>\n' +
        "      Tag(id: json['id'] as String);",
    );
    // A non-async component binds its locals at the top of build().
    expect(dart).toContain(
      '    final tag = Tag.fromJson(jsonDecode(raw) as Map<String, dynamic>);\n' +
        '    return Text(tag.id);',
    );
  });

  test('a factory that fits stays on one line', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, json } from 'flutter-tsx';\n" +
        'interface Hit {\n  n: number;\n}\n' +
        'export const Probe = () => {\n' +
        '  const hit = json(raw) as Hit;\n' +
        '  return <Text>{hit.n}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    // 78 columns, so it fits — checked against dart format, which leaves it.
    expect(dart).toContain(
      '  factory Hit.fromJson(Map<String, dynamic> json) => ' +
        "Hit(n: json['n'] as num);",
    );
  });

  // A local that is no json call must still be declared: emitting a reference
  // to a name that was never bound would be silently broken Dart.
  test('a computed local is bound at the top of build', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(2);\n' +
        '  const doubled = count * 2;\n' +
        '  return <Text>Total: {doubled}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      '    final doubled = _count * 2;\n' +
        "    return Text('Total: $doubled');",
    );
  });

  // A read must translate identically wherever it appears. Emitting the TSX
  // name into a prop produced Dart referring to a name that does not exist.
  test('a plugin read is translated in a prop, not only in a child', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text } from 'flutter-tsx';\n" +
        "import { usePackageInfo } from 'plugin:package_info_plus';\n" +
        'export const Probe = () => {\n' +
        '  const info = usePackageInfo();\n' +
        '  if (!info) {\n' +
        '    return <Text>loading</Text>;\n' +
        '  }\n' +
        '  return <Text semanticsLabel={info.appName}>hi</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      "    return Text('hi', semanticsLabel: _info!.appName);",
    );
  });

  test('a cast that is not a json decode stays a numbered error', () => {
    // Only `json(body) as Model` decodes; any other cast is not a decode and
    // must not be silently translated into one.
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'interface Album {\n  title: string;\n}\n' +
          'const pick = (body: string): Album => body as Album;\n' +
          'export const Probe = () => <Text>{pick("x").title}</Text>;\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:5:39 — `body as Album` is an expression form the ' +
          'compiler does not translate to Dart.',
      ),
    );
  });

  // In either position an unresolvable read is refused rather than emitted
  // verbatim, which would have produced Dart naming something that does not
  // exist there.
  test('a read the compiler cannot resolve is a numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text>{lookup().name}</Text>;\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:2:35 — `lookup().name` is an expression form the ' +
          'compiler does not translate to Dart.',
      ),
    );

    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Text semanticsLabel={lookup().name}>hi</Text>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0305 probe.tsx:3:25 — `lookup().name` reads a member the ' +
          'compiler cannot resolve to a Dart one.',
      ),
    );
  });

  test('json without a cast to a model is a numbered error', () => {
    expect(
      transpileComponent({
        source: source('  const album = json(res.body);\n'),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0335 probe.tsx:11:17 — `json` needs an interface from this file ' +
          'and a body: `json(res.body) as Album`.',
      ),
    );
  });
});

describe('transpileComponent — branching handlers', () => {
  const component = (handler: string): string =>
    `import { Text, useState } from 'flutter-tsx';

export const Branch = () => {
  const [count, setCount] = useState(0);

  const go = () => {
${handler}
  };

  return <Text onClick={go}>{count}</Text>;
};
`;

  const bodyOf = async (handler: string): Promise<string> => {
    const dart = await transpileComponent({
      source: component(handler),
      filePath: '/tmp/Branch.tsx',
    });
    const start = dart.indexOf('  void _go() {');
    return dart.slice(start, dart.indexOf('\n  }\n', start) + 5);
  };

  test('an if with no else', async () => {
    expect(await bodyOf('    if (count > 1) {\n      setCount(0);\n    }'))
      .toBe(`  void _go() {
    if (_count > 1) {
      setState(() {
        _count = 0;
      });
    }
  }
`);
  });

  test('branches that are single statements rather than blocks', async () => {
    expect(
      await bodyOf('    if (count > 1) setCount(0);\n    else setCount(1);'),
    ).toBe(`  void _go() {
    if (_count > 1) {
      setState(() {
        _count = 0;
      });
    } else {
      setState(() {
        _count = 1;
      });
    }
  }
`);
  });

  test('an else branch that is a block of several statements', async () => {
    expect(
      await bodyOf(
        '    if (count > 1) {\n      setCount(0);\n    } else {\n' +
          '      setCount(2);\n      setCount(3);\n    }',
      ),
    ).toBe(`  void _go() {
    if (_count > 1) {
      setState(() {
        _count = 0;
      });
    } else {
      setState(() {
        _count = 2;
        _count = 3;
      });
    }
  }
`);
  });
});

describe('transpileComponent — prop types', () => {
  test('a list of models declared in the same file', async () => {
    const dart = await transpileComponent({
      source: `interface Job {
  title: string;
}

export const Board = ({ jobs }: { jobs: Job[] }) => (
  <Column>
    {jobs.map((job) => (
      <Text>{job.title}</Text>
    ))}
  </Column>
);
`,
      filePath: '/tmp/Board.tsx',
    });

    expect(dart).toContain('final List<Job> jobs;');
    expect(dart).toContain('for (final job in jobs) Text(job.title)');
  });

  test('a model field that is itself a model', async () => {
    const dart = await transpileComponent({
      source: `interface Company {
  name: string;
}

interface Job {
  title: string;
  company: Company;
}

export const Board = ({ jobs }: { jobs: Job[] }) => (
  <Column>
    {jobs.map((job) => (
      <Text>{job.company.name}</Text>
    ))}
  </Column>
);
`,
      filePath: '/tmp/Nested.tsx',
    });

    expect(dart).toContain('final Company company;');
    expect(dart).toContain('for (final job in jobs) Text(job.company.name)');
  });

  test('a method whose Dart semantics differ is refused, not guessed', () => {
    expect(
      transpileComponent({
        source:
          'export const Odd = ({ name }: { name: string }) => ' +
          '<Text>{name.slice(0, 2)}</Text>;\n',
        filePath: '/tmp/Odd.tsx',
      }),
    ).rejects.toThrow(/TSX0341 .* `slice` has no Dart counterpart/);
  });

  test('a list of lists', async () => {
    const dart = await transpileComponent({
      source:
        'export const Grid = ({ rows }: { rows: string[][] }) => ' +
        '<Text>{rows.length}</Text>;\n',
      filePath: '/tmp/Grid.tsx',
    });

    expect(dart).toContain('final List<List<String>> rows;');
  });

  test('reports a prop type that has no Dart mapping', () => {
    expect(
      transpileComponent({
        source:
          'export const Odd = ({ when }: { when: Date }) => ' +
          '<Text>x</Text>;\n',
        filePath: '/tmp/Odd.tsx',
      }),
    ).rejects.toThrow(/TSX0309/);
  });
});

describe('transpileComponent — tuples and generics', () => {
  test('a tuple prop is a Dart record, indexed by position', async () => {
    const dart = await transpileComponent({
      source:
        'export const Pair = ({ span }: { span: [string, number] }) => ' +
        '<Text>{span[0]}</Text>;\n',
      filePath: '/tmp/Pair.tsx',
    });

    expect(dart).toContain('final (String, num) span;');
    expect(dart).toContain('Text(span.$1)');
  });

  test('a generic helper keeps its type parameter', async () => {
    const dart = await transpileComponent({
      source: `const firstOr = <T,>(values: T[], fallback: T): T =>
  values[0] ?? fallback;

export const Head = ({ names }: { names: string[] }) => (
  <Text>{firstOr(names, '-')}</Text>
);
`,
      filePath: '/tmp/Head.tsx',
    });

    expect(dart).toContain(
      'T firstOr<T>(List<T> values, T fallback) =>\n' +
        '    values.elementAtOrNull(0) ?? fallback;',
    );
  });
});

describe('transpileComponent — helper parameters', () => {
  test('a default value becomes an optional positional parameter', async () => {
    const dart = await transpileComponent({
      source:
        "const tag = (value: string, prefix: string = '#'): string =>\n" +
        '  prefix + value;\n' +
        "export const A = () => <Text>{tag('x')}</Text>;\n",
      filePath: '/tmp/A.tsx',
    });

    expect(dart).toContain(
      "String tag(String value, [String prefix = '#']) => prefix + value;",
    );
  });

  test('a rest parameter is refused, since Dart has none', () => {
    expect(
      transpileComponent({
        source:
          "const join = (...values: string[]): string => values.join(', ');\n" +
          "export const A = () => <Text>{join('a')}</Text>;\n",
        filePath: '/tmp/A.tsx',
      }),
    ).rejects.toThrow(
      /TSX0339 .* `join` cannot take a rest parameter: Dart has none — pass a list\./,
    );
  });

  test('a default value that is not a literal is refused', () => {
    expect(
      transpileComponent({
        source:
          'const tag = (value: string, prefix: string = value): string =>\n' +
          '  prefix + value;\n' +
          "export const A = () => <Text>{tag('x')}</Text>;\n",
        filePath: '/tmp/A.tsx',
      }),
    ).rejects.toThrow(
      /TSX0339 .* `tag` needs a literal default for `prefix`\./,
    );
  });

  test('a type alias is a model, like an interface', async () => {
    const dart = await transpileComponent({
      source:
        'type Point = { x: number; y: number };\n' +
        'export const A = ({ p }: { p: Point }) => <Text>{p.x}</Text>;\n',
      filePath: '/tmp/A.tsx',
    });

    expect(dart).toContain('class Point {');
    expect(dart).toContain('final Point p;');
    expect(dart).toContain("Text('${p.x}')");
  });
});

describe('transpileComponent — inference edges', () => {
  test('a generic type is resolved from a later argument when the first says nothing', async () => {
    const dart = await transpileComponent({
      source: `const pick = <T,>(fallback: T, values: T[]): T =>
  values[0] ?? fallback;

export const Head = ({ names }: { names: string[] }) => (
  <Text>{pick(names[0] ?? '-', names)}</Text>
);
`,
      filePath: '/tmp/Head.tsx',
    });

    // Resolved to String through `values`, so no needless interpolation.
    expect(dart).toContain(
      "Text(pick(names.elementAtOrNull(0) ?? '-', names))",
    );
  });

  test('a parameter that does not mention the type variable is skipped', async () => {
    const dart = await transpileComponent({
      source: `const nth = <T,>(count: number, values: T[], fallback: T): T =>
  values[0] ?? fallback;

export const Head = ({ names }: { names: string[] }) => (
  <Text>{nth(1, names, '-')}</Text>
);
`,
      filePath: '/tmp/Head.tsx',
    });

    expect(dart).toContain("Text(nth(1, names, '-'))");
  });

  test('a generic type that no argument pins down stays unknown', async () => {
    const dart = await transpileComponent({
      source: `const headOf = <T,>(values: T[], fallback: T): T =>
  values[0] ?? fallback;

export const Head = ({ names }: { names: string[] }) => (
  <Text>{headOf(names.filter((name) => name !== ''), names[0] ?? '-')}</Text>
);
`,
      filePath: '/tmp/Head.tsx',
    });

    // Neither argument is a plain name or literal, so the return type is not
    // known to be a String and the value is interpolated rather than assumed.
    expect(dart).toContain("'${headOf(");
  });

  test('a tuple holding a type with no Dart equivalent is refused', () => {
    expect(
      transpileComponent({
        source:
          'export const A = ({ pair }: { pair: [string, Date] }) => ' +
          '<Text>{pair[0]}</Text>;\n',
        filePath: '/tmp/A.tsx',
      }),
    ).rejects.toThrow(/TSX0309/);
  });
});

describe('transpileComponent — helpers inside a component', () => {
  test('a typed local function becomes a private method that can read state', async () => {
    const dart = await transpileComponent({
      source: `import { Text, useState } from 'flutter-tsx';

export const Ticker = ({ unit }: { unit: string }) => {
  const [count, setCount] = useState(0);

  const label = (value: number): string => \`\${value} \${unit}\`;

  return <Text onClick={() => setCount(count + 1)}>{label(count)}</Text>;
};
`,
      filePath: '/tmp/Ticker.tsx',
    });

    expect(dart).toContain(
      "String _label(num value) => '$value ${widget.unit}';",
    );
    expect(dart).toContain('Text(_label(_count))');
  });

  test('an untyped local arrow stays a handler', async () => {
    const dart = await transpileComponent({
      source: `import { Text, useState } from 'flutter-tsx';

export const Tap = () => {
  const [count, setCount] = useState(0);

  const bump = () => {
    setCount(count + 1);
  };

  return <Text onClick={bump}>{count}</Text>;
};
`,
      filePath: '/tmp/Tap.tsx',
    });

    expect(dart).toContain('void _bump() {');
  });
});

describe('transpileComponent — enums and unions', () => {
  test('a string enum becomes named constants, which is what it is at runtime', async () => {
    const dart = await transpileComponent({
      source: `enum Status {
  Active = 'active',
  Paused = 'paused',
}

export const Badge = ({ status }: { status: Status }) => (
  <Text>{status === Status.Active ? 'on' : 'off'}</Text>
);
`,
      filePath: '/tmp/Badge.tsx',
    });

    expect(dart).toContain(`abstract final class Status {
  static const String active = 'active';
  static const String paused = 'paused';
}`);
    expect(dart).toContain('final String status;');
    expect(dart).toContain("status == Status.active ? 'on' : 'off'");
  });

  test('a numeric enum numbers its members the way TypeScript does', async () => {
    const dart = await transpileComponent({
      source: `enum Level {
  Low,
  Medium,
  High = 9,
}

export const Meter = () => <Text>{Level.Medium}</Text>;
`,
      filePath: '/tmp/Meter.tsx',
    });

    expect(dart).toContain(`abstract final class Level {
  static const int low = 0;
  static const int medium = 1;
  static const int high = 9;
}`);
  });

  test('a numeric enum is an int prop', async () => {
    const dart = await transpileComponent({
      source: `enum Level {
  Low,
  High,
}

export const Meter = ({ level }: { level: Level }) => (
  <Text>{level === Level.High ? 'high' : 'low'}</Text>
);
`,
      filePath: '/tmp/Meter.tsx',
    });

    expect(dart).toContain('final int level;');
    expect(dart).toContain('level == Level.high');
  });

  test('a union of string literals is a String prop', async () => {
    const dart = await transpileComponent({
      source:
        "export const Chip = ({ tone }: { tone: 'warn' | 'ok' }) => " +
        '<Text>{tone}</Text>;\n',
      filePath: '/tmp/Chip.tsx',
    });

    expect(dart).toContain('final String tone;');
    expect(dart).toContain('Text(tone)');
  });

  test('an enum member that is not a literal is refused', () => {
    expect(
      transpileComponent({
        source:
          'enum Odd {\n  Computed = 1 + 1,\n}\n' +
          'export const A = () => <Text>{Odd.Computed}</Text>;\n',
        filePath: '/tmp/A.tsx',
      }),
    ).rejects.toThrow(
      /TSX0340 .* `Odd.Computed` must be a string or number literal\./,
    );
  });
});

describe('transpileComponent — controllers a component owns', () => {
  test('a controller becomes a field of the State, disposed with it', async () => {
    const dart = await transpileComponent({
      source:
        "import { TextField, TextEditingController } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const query = new TextEditingController();\n' +
        '  return <TextField controller={query} />;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    // Made with the widget and disposed with it — the lifecycle a local
    // rebuilt every frame could never have.
    expect(dart).toContain(
      '  final TextEditingController _query = TextEditingController();',
    );
    expect(dart).toContain(
      '  @override\n  void dispose() {\n    _query.dispose();\n' +
        '    super.dispose();\n  }',
    );
    expect(dart).toContain('TextField(controller: _query)');
  });

  test('a class that is not a value to own is a numbered error', () => {
    // `Text` is a widget, not something with a lifecycle to own.
    expect(
      transpileComponent({
        source:
          "import { Column, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const thing = new Text();\n' +
          '  return <Column>{thing}</Column>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0351 .* `Text` is not a value a component owns/);
  });
});

describe('transpileComponent — a value a plugin answers with', () => {
  const source = (body: string): string =>
    "import { Text } from 'flutter-tsx';\n" +
    "import { useSharedPreferences } from 'plugin:shared_preferences';\n" +
    'export const Probe = () => {\n' +
    '  const prefs = useSharedPreferences();\n' +
    `  return ${body};\n` +
    '};\n';

  test('a call that answers at once stands where a value stands', async () => {
    // Not every plugin call is a Future: a preference is read there and then,
    // and a read that has to be named first is a value the compiler refuses
    // to treat as one.
    const dart = await transpileComponent({
      source: source("<Text>{prefs?.getString('name') ?? 'guest'}</Text>"),
      filePath: 'probe.tsx',
    });

    // The read is already a String, so it is passed as one rather than
    // interpolated into `'${…}'`.
    expect(dart).toContain(
      "    return Text(_prefs?.getString('name') ?? 'guest');",
    );
  });

  test('a value that is not a String is interpolated', async () => {
    const dart = await transpileComponent({
      source: source("<Text>{prefs?.getInt('visits')}</Text>"),
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("    return Text('${_prefs?.getInt('visits')}');");
  });
});

describe('transpileComponent — dates and times', () => {
  const picker = (attributes: string): Promise<string> =>
    transpileComponent({
      source:
        "import { CalendarDatePicker } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        `  <CalendarDatePicker ${attributes} onDateChanged={() => {}} />\n` +
        ');\n',
      filePath: 'probe.tsx',
    });

  test('a written date is the DateTime it names', async () => {
    const dart = await picker(
      'initialDate="2026-01-31" firstDate="2020-01-01" lastDate="2030-12-31"',
    );

    expect(dart).toContain('      initialDate: DateTime(2026, 1, 31),');
    expect(dart).toContain('      firstDate: DateTime(2020, 1, 1),');
  });

  test('a value that is not a date is a numbered error', () => {
    expect(
      picker(
        'initialDate="tomorrow" firstDate="2020-01-01" lastDate="2030-12-31"',
      ),
    ).rejects.toThrow(
      /TSX0205 .* `tomorrow` is not a date, written YYYY-MM-DD: `2026-01-31`/,
    );
  });
});

describe('transpileComponent — failures with a type', () => {
  const probe = (body: string): Promise<string> =>
    transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        "import { CameraException, useCamera } from 'plugin:camera';\n" +
        'export const Probe = () => {\n' +
        '  const cam = useCamera();\n' +
        "  const [message, setMessage] = useState('none');\n" +
        '  const shoot = async () => {\n' +
        '    try {\n' +
        '      await cam?.takePicture();\n' +
        '    } catch (error) {\n' +
        body +
        '    }\n' +
        '  };\n' +
        '  return <Text onClick={shoot}>{message}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
      pluginApiDirs: ['ref/plugins'],
    });

  test('a class the compiler does not know is a numbered error', () => {
    // `Error` is a JavaScript class; nothing thrown in Dart is one.
    expect(
      probe('      if (error instanceof Error) {\n' + '      }\n'),
    ).rejects.toThrow(
      /TSX0352 .* test a value the compiler knows against a class it knows/,
    );
  });

  test('a test on something unnamed is a numbered error', () => {
    // Only a named value can be promoted, so only a named value can be
    // tested — the branch would otherwise read members off nothing.
    expect(
      probe(
        '      if (error.cause instanceof CameraException) {\n' + '      }\n',
      ),
    ).rejects.toThrow(/TSX0352 /);
  });

  test('converting nothing, or more than one value, is a numbered error', () => {
    expect(probe('      setMessage(String());\n')).rejects.toThrow(
      /TSX0353 .* `String\(value\)` converts one value/,
    );
    expect(probe('      setMessage(String(error, error));\n')).rejects.toThrow(
      /TSX0353 /,
    );
  });
});

describe('transpileComponent — values a plugin declares', () => {
  const probe = (body: string): Promise<string> =>
    transpileComponent({
      source:
        "import { Column, ElevatedButton, Text, useState } from 'flutter-tsx';\n" +
        "import { MediaType } from 'plugin:http';\n" +
        "import { SharedPreferencesWithCache } from 'plugin:shared_preferences';\n" +
        "import { launchUrl, WebViewConfiguration } from 'plugin:url_launcher';\n" +
        'export const Probe = () => {\n' +
        "  const [label, setLabel] = useState('none');\n" +
        '  const run = async () => {\n' +
        body +
        '  };\n' +
        '  return (\n' +
        '    <Column>\n' +
        '      <Text>{label}</Text>\n' +
        '      <ElevatedButton onClick={run}>Go</ElevatedButton>\n' +
        '    </Column>\n' +
        '  );\n' +
        '};\n',
      filePath: 'probe.tsx',
      pluginApiDirs: [new URL('../../ref/plugins', import.meta.url).pathname],
    });

  test('`new` builds a value the plugin exports', async () => {
    const dart = await probe(
      "    const type = new MediaType('text', 'plain');\n" +
        '    setLabel(type.mimeType);\n',
    );

    expect(dart).toContain("final type = MediaType('text', 'plain');");
    expect(dart).toContain('_label = type.mimeType;');
  });

  test('a static of a plugin class is the way some values are made', async () => {
    const dart = await probe(
      '    const cached = await SharedPreferencesWithCache.create({\n' +
        '      cacheOptions: { allowList: null },\n' +
        '    });\n' +
        "    setLabel('ready');\n",
    );

    expect(dart).toContain(
      'final cached = await SharedPreferencesWithCache.create(\n' +
        '      cacheOptions: SharedPreferencesWithCacheOptions(allowList: null),\n' +
        '    );',
    );
  });

  test('`new` with an object builds a constructor of named parameters', async () => {
    const dart = await probe(
      '    const config = new WebViewConfiguration({ enableJavaScript: true });\n' +
        "    await launchUrl('https://flutter.dev', {\n" +
        '      webViewConfiguration: config,\n' +
        '    });\n' +
        "    setLabel('opened');\n",
    );

    expect(dart).toContain(
      'final config = WebViewConfiguration(enableJavaScript: true);',
    );
    expect(dart).toContain('webViewConfiguration: config');
  });

  test('a spread where a constructor wants named arguments is refused', () => {
    expect(
      probe(
        '    const config = new WebViewConfiguration({ ...{ enableJavaScript: true } });\n' +
          "    setLabel('made');\n",
      ),
    ).rejects.toThrow(/TSX0305/);
  });

  test('`new` on something no plugin exports is a numbered error', () => {
    expect(probe('    const thing = new Whatever();\n')).rejects.toThrow(
      /TSX0349 .* `Whatever` is not a class this project can construct/,
    );
  });

  test('a static no plugin class declares is a numbered error', () => {
    expect(probe("    await MediaType.conjure('text');\n")).rejects.toThrow(
      /TSX03/,
    );
  });
});

describe('transpileComponent — model literals', () => {
  const probe = (value: string): Promise<string> =>
    transpileComponent({
      source:
        "import { Column, Text } from 'flutter-tsx';\n" +
        'interface Artist { name: string }\n' +
        'const Card = ({ artist }: { artist: Artist }) => ' +
        '<Text>{artist.name}</Text>;\n' +
        'export const Probe = () => (\n' +
        '  <Column>\n' +
        `    <Card artist={${value}} />\n` +
        '  </Column>\n' +
        ');\n',
      filePath: 'probe.tsx',
    });

  test('an object literal where a model is expected constructs one', async () => {
    expect(await probe("{ name: 'Ada' }")).toContain(
      "Card(artist: Artist(name: 'Ada'))",
    );
  });

  test('a field the model does not have is a numbered error', () => {
    expect(probe("{ nam: 'Ada' }")).rejects.toThrow(
      /TSX0344 .* `Artist` has no field `nam`\./,
    );
  });

  test('a shape that is not `{ field: value }` is a numbered error', () => {
    expect(probe("{ ...{ name: 'Ada' } }")).rejects.toThrow(
      /TSX0344 .* `Artist` is written as/,
    );
  });
});

describe('transpileComponent — guards that prove nothing', () => {
  test('`x == null` in a handler leaves early, and narrows what follows', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        "  const [label, setLabel] = useState('a');\n" +
        '  const run = () => {\n' +
        '    if (label == null) {\n' +
        '      return;\n' +
        '    }\n' +
        "    setLabel('b');\n" +
        '  };\n' +
        '  return <Text onClick={run}>{label}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain('    if (_label == null) {\n      return;\n    }');
  });
});

describe('transpileComponent — the edges of what is expressible', () => {
  test('a component-level helper with a body reads the component around it', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count, setCount] = useState(2);\n' +
        '  const label = (prefix: string): string => {\n' +
        '    const shown = prefix.trim();\n' +
        '    return `${shown}: ${count}`;\n' +
        '  };\n' +
        "  return <Text onClick={() => setCount(count + 1)}>{label('n')}</Text>;\n" +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      '  String _label(String prefix) {\n' +
        '    final shown = prefix.trim();\n' +
        "    return '$shown: $_count';\n" +
        '  }',
    );
  });

  test('a helper that needs dart:math imports it under its prefix', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text } from 'flutter-tsx';\n" +
        'export const spread = (a: number, b: number): number =>\n' +
        '  Math.max(a, b) - Math.min(a, b);\n' +
        'export const Probe = () => <Text>{spread(1, 2)}</Text>;\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("import 'dart:math' as math;");
    expect(dart).toContain(
      'num spread(num a, num b) => math.max(a, b) - math.min(a, b);',
    );
  });

  test('a component that needs dart:math imports it under its prefix', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text, useState } from 'flutter-tsx';\n" +
        'export const Probe = () => {\n' +
        '  const [count] = useState(9);\n' +
        '  return <Text>{Math.sqrt(count)}</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("import 'dart:math' as math;");
    expect(dart).toContain("Text('${math.sqrt(_count)}')");
  });

  test('data that needs a library imports it too', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text } from 'flutter-tsx';\n" +
        'export const HALF: number = Math.sqrt(4);\n' +
        'export const Probe = () => <Text>{HALF}</Text>;\n',
      filePath: 'probe.tsx',
    });

    // Computed data is `final`, not `const`, and the library it needs is
    // imported — a `math.` with no import would not compile.
    expect(dart).toContain("import 'dart:math' as math;");
    expect(dart).toContain('final num half = math.sqrt(4);');
  });

  test('a Math member with no Dart counterpart is refused, not guessed', () => {
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text>{Math.cbrt(8)}</Text>;\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305/);

    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => <Text>{Math.LN2}</Text>;\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305/);
  });

  test('an element written as an attribute value needs no braces', async () => {
    const dart = await transpileComponent({
      source:
        "import { AppBar, Scaffold, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Scaffold appBar=<AppBar title=<Text>Hi</Text> />>\n' +
        '    <Text>body</Text>\n' +
        '  </Scaffold>\n' +
        ');\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("appBar: AppBar(title: const Text('Hi'))");
  });

  test('two widgets in a slot that holds one is a numbered error', () => {
    // Rendering the first and dropping the second is the silent kind of
    // wrong; saying which two, and what to do, is the loud kind.
    expect(
      transpileComponent({
        source:
          "import { ElevatedButton, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <ElevatedButton>\n' +
          '    <Text>one</Text>\n' +
          '    <Text>two</Text>\n' +
          '  </ElevatedButton>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      /TSX0350 .* this slot holds one child: wrap them in a <Column> or a <Row>\./,
    );
  });

  test('a call statement that claims nothing is a numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  doSomething();\n' +
          '  return <Text>hi</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0346 .* `doSomething\(\);` is a statement/);
  });

  test('a list of lists binds no element the compiler can read', () => {
    expect(
      transpileComponent({
        source:
          "import { Column, Text } from 'flutter-tsx';\n" +
          'interface Grid { rows: string[][] }\n' +
          'export const Probe = ({ grid }: { grid: Grid }) => (\n' +
          '  <Column>\n' +
          '    {grid.rows.map((row) => (\n' +
          '      <Text>{row.missing}</Text>\n' +
          '    ))}\n' +
          '  </Column>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305/);
  });

  test('a list of models written inline is constructed, and its class imported', async () => {
    const dart = await transpileComponent({
      source:
        "import { Column, Text } from 'flutter-tsx';\n" +
        'interface Tag { name: string }\n' +
        'const Row = ({ tags }: { tags: Tag[] }) => (\n' +
        '  <Column>\n' +
        '    {tags.map((tag) => (\n' +
        '      <Text>{tag.name}</Text>\n' +
        '    ))}\n' +
        '  </Column>\n' +
        ');\n' +
        'export const Probe = () => (\n' +
        "  <Row tags={[{ name: 'a' }, { name: 'b' }]} />\n" +
        ');\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("Row(tags: [Tag(name: 'a'), Tag(name: 'b')])");
  });

  test('a widget with no children slot may still be written with tags', async () => {
    const dart = await transpileComponent({
      source:
        "import { AppBar, Scaffold, Text } from 'flutter-tsx';\n" +
        'export const Probe = () => (\n' +
        '  <Scaffold appBar={<AppBar title={<Text>Hi</Text>}></AppBar>}>\n' +
        '    <Text>body</Text>\n' +
        '  </Scaffold>\n' +
        ');\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("appBar: AppBar(title: const Text('Hi'))");
  });

  test('iterating something that is not a list is refused', () => {
    expect(
      transpileComponent({
        source:
          "import { Column, Text } from 'flutter-tsx';\n" +
          'interface Note { title: string }\n' +
          'export const Probe = ({ note }: { note: Note }) => (\n' +
          '  <Column>\n' +
          '    {note.title.map((letter) => (\n' +
          '      <Text>{letter}</Text>\n' +
          '    ))}\n' +
          '  </Column>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      /TSX0348 .* `note.title` is a String, not a list — only a list renders/,
    );
  });

  test('a chain of list methods keeps the element type through it', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text } from 'flutter-tsx';\n" +
        'interface Tag { name: string }\n' +
        "export const TAGS: Tag[] = [{ name: 'a' }];\n" +
        'export const Probe = () => (\n' +
        '  <Text>\n' +
        "    {TAGS.filter((tag) => tag.name.startsWith('a'))\n" +
        '      .map((tag) => tag.name)\n' +
        "      .join(', ')}\n" +
        '  </Text>\n' +
        ');\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      "tags.where((tag) => tag.name.startsWith('a')).map((tag) => tag.name)",
    );
  });

  test('a prop written as a quoted expression is translated', async () => {
    const dart = await transpileComponent({
      source:
        "import { Text } from 'flutter-tsx';\n" +
        'export const Probe = () => <Text maxLines={1 + 1}>hi</Text>;\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("Text('hi', maxLines: 1 + 1)");
  });

  test('a `return <value>;` in a handler is a numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = () => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  const run = () => {\n' +
          '    return count;\n' +
          '  };\n' +
          '  return <Text onClick={run}>{count}</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      /TSX0342 .* a handler returns nothing: use `return;` to leave it early\./,
    );
  });

  test('iterating a list of something the model does not name yields nothing', () => {
    // A list of lists has no element type the compiler can bind a name to, so
    // the read inside is reported rather than compiled against a guess.
    expect(
      transpileComponent({
        source:
          "import { Column, Text } from 'flutter-tsx';\n" +
          'interface Grid { rows: string[][] }\n' +
          'export const Probe = ({ grid }: { grid: Grid }) => (\n' +
          '  <Column>\n' +
          '    {grid.rows.map((row) => (\n' +
          '      <Text>{row.missing}</Text>\n' +
          '    ))}\n' +
          '  </Column>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305/);
  });
});

describe('transpileComponent — helper functions', () => {
  test('a module-level helper becomes a top-level Dart function', async () => {
    const dart = await transpileComponent({
      source: `const shout = (value: string): string => value.toUpperCase();

export const Loud = ({ name }: { name: string }) => <Text>{shout(name)}</Text>;
`,
      filePath: '/tmp/Loud.tsx',
    });

    expect(dart).toBe(`import 'package:flutter/material.dart';

String shout(String value) => value.toUpperCase();

class Loud extends StatelessWidget {
  const Loud({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Text(shout(name));
  }
}
`);
  });

  test('a call a helper cannot make is a numbered error', () => {
    // A helper stands outside a component, where no plugin handle is in
    // scope: a call it cannot make is refused rather than printed as Dart
    // that names something the file does not have.
    expect(
      transpileComponent({
        source: `const stamp = (value: string): string => structuredClone(value);

export const Stamped = () => <Text>{stamp('a')}</Text>;
`,
        filePath: '/tmp/Stamped.tsx',
      }),
    ).rejects.toThrow(/TSX0305 .* `structuredClone\(value\)`/);
  });

  test('a helper taking and returning a list', async () => {
    const dart = await transpileComponent({
      source: `const kept = (values: string[]): string[] =>
  values.filter((value) => value !== '');

export const Kept = ({ names }: { names: string[] }) => (
  <Text>{kept(names).length}</Text>
);
`,
      filePath: '/tmp/Kept.tsx',
    });

    expect(dart).toContain(
      "List<String> kept(List<String> values) =>\n    values.where((value) => value != '').toList();",
    );
  });

  test('a helper without a return type is refused', () => {
    expect(
      transpileComponent({
        source:
          'const shout = (value: string) => value.toUpperCase();\n' +
          "export const Loud = () => <Text>{shout('a')}</Text>;\n",
        filePath: '/tmp/Loud.tsx',
      }),
    ).rejects.toThrow(
      /TSX0339 .* `shout` needs an explicit return type: `\(value: string\): string => …`\./,
    );
  });

  test('a helper returning a type with no Dart equivalent is refused', () => {
    expect(
      transpileComponent({
        source:
          'const when = (value: string): Date => new Date(value);\n' +
          "export const At = () => <Text>{when('x')}</Text>;\n",
        filePath: '/tmp/At.tsx',
      }),
    ).rejects.toThrow(
      /TSX0339 .* `when` returns a type with no Dart equivalent: Date\./,
    );
  });

  test('a helper that destructures a parameter is refused', () => {
    expect(
      transpileComponent({
        source:
          'const label = ({ name }: { name: string }): string => name;\n' +
          "export const At = () => <Text>{label({ name: 'a' })}</Text>;\n",
        filePath: '/tmp/At.tsx',
      }),
    ).rejects.toThrow(/TSX0339 .* `label` takes plain named parameters/);
  });

  test('a helper with a block body keeps its body', async () => {
    const dart = await transpileComponent({
      source:
        'const shout = (value: string): string => {\n' +
        '  const trimmed = value.trim();\n' +
        '  return trimmed.toUpperCase();\n' +
        '};\n' +
        "export const At = () => <Text>{shout('a')}</Text>;\n",
      filePath: '/tmp/At.tsx',
    });

    expect(dart).toContain(
      'String shout(String value) {\n' +
        '  final trimmed = value.trim();\n' +
        '  return trimmed.toUpperCase();\n' +
        '}',
    );
  });

  test('a helper parameter without a type is refused', () => {
    expect(
      transpileComponent({
        source:
          'const shout = (value): string => value;\n' +
          "export const Loud = () => <Text>{shout('a')}</Text>;\n",
        filePath: '/tmp/Loud.tsx',
      }),
    ).rejects.toThrow(/TSX0339 .* `shout` needs a type for `value`\./);
  });
});

describe('transpileComponent — indexing a list', () => {
  test('indexing yields a nullable value, as the TypeScript type says', async () => {
    // With noUncheckedIndexedAccess, `names[0]` is `string | undefined` in
    // TSX. Dart's `names[0]` throws instead of returning null, so the
    // faithful translation is elementAtOrNull — which also makes `??` mean
    // something rather than being dead code.
    const dart = await transpileComponent({
      source:
        'export const Head = ({ names }: { names: string[] }) => ' +
        "<Text>{names[0] ?? '-'}</Text>;\n",
      filePath: '/tmp/Head.tsx',
    });

    expect(dart).toContain("Text(names.elementAtOrNull(0) ?? '-')");
  });

  test('indexing something that is not a list stays an index read', async () => {
    const dart = await transpileComponent({
      source:
        'export const Pick = ({ row }: { row: string }) => ' +
        '<Text>{row[0]}</Text>;\n',
      filePath: '/tmp/Pick.tsx',
    });

    expect(dart).toContain('row[0]');
  });

  test('a callback that destructures its parameter is refused', () => {
    expect(
      transpileComponent({
        source:
          'export const Odd = ({ pairs }: { pairs: string[] }) => ' +
          '<Text>{pairs.filter(({ x }) => x).length}</Text>;\n',
        filePath: '/tmp/Odd.tsx',
      }),
    ).rejects.toThrow(/TSX0338 .* a callback parameter is one name/);
  });

  test('a callback with a block body is refused', () => {
    expect(
      transpileComponent({
        source:
          'export const Odd = ({ names }: { names: string[] }) => ' +
          "<Text>{names.filter((n) => { return n !== ''; }).length}</Text>;\n",
        filePath: '/tmp/Odd.tsx',
      }),
    ).rejects.toThrow(/TSX0338 .* a callback here is one expression/);
  });

  test('a reduce with no initial value is refused', () => {
    expect(
      transpileComponent({
        source:
          'export const Odd = ({ ns }: { ns: number[] }) => ' +
          '<Text>{ns.reduce((a, b) => a + b)}</Text>;\n',
        filePath: '/tmp/Odd.tsx',
      }),
    ).rejects.toThrow(/TSX0338 .* `reduce` needs an initial value/);
  });

  test('indexing a map stays an index read, which is already nullable', async () => {
    const dart = await transpileComponent({
      source:
        'export const Pick = ({ names }: { names: string[] }) => ' +
        '<Text>{names.length}</Text>;\n',
      filePath: '/tmp/Pick.tsx',
    });

    expect(dart).toContain('names.length');
  });
});

describe('transpileComponent — statement forms', () => {
  const handler = (body: string): string =>
    `import { Text, useState } from 'flutter-tsx';

export const Loop = ({ items }: { items: string[] }) => {
  const [count, setCount] = useState(0);

  const go = () => {
${body}
  };

  return <Text onClick={go}>{count}</Text>;
};
`;

  const methodOf = async (body: string): Promise<string> => {
    const dart = await transpileComponent({
      source: handler(body),
      filePath: '/tmp/Loop.tsx',
    });
    const start = dart.indexOf('  void _go() {');
    return dart.slice(start, dart.indexOf('\n  }\n', start) + 5);
  };

  test('a while loop', async () => {
    expect(
      await methodOf(
        '    while (count < 3) {\n      setCount(count + 1);\n    }',
      ),
    ).toBe(`  void _go() {
    while (_count < 3) {
      setState(() {
        _count++;
      });
    }
  }
`);
  });

  test('a try with only a finally compiles to the same in Dart', async () => {
    const dart = await transpileComponent({
      source: handler(
        '    try {\n      setCount(1);\n    } finally {\n      setCount(2);\n    }',
      ),
      filePath: '/tmp/Loop.tsx',
    });

    expect(dart).toContain(
      '    try {\n      setState(() {\n        _count = 1;\n      });\n' +
        '    } finally {\n      setState(() {\n        _count = 2;\n' +
        '      });\n    }',
    );
  });

  test('a for … of that destructures is refused', () => {
    expect(
      transpileComponent({
        source: handler(
          '    for (const [a, b] of [[1, 2]]) {\n      setCount(a);\n    }',
        ),
        filePath: '/tmp/Loop.tsx',
      }),
    ).rejects.toThrow(
      /TSX0337 .* a `for … of` binds one name: `for \(const item of items\)`\./,
    );
  });

  test('a switch whose last case has no body is refused', () => {
    expect(
      transpileComponent({
        source: handler(
          '    switch (count) {\n      case 0:\n        setCount(1);\n' +
            '        break;\n      case 1:\n    }',
        ),
        filePath: '/tmp/Loop.tsx',
      }),
    ).rejects.toThrow(
      /TSX0337 .* the last `case` of a `switch` needs a body\./,
    );
  });
});

/**
 * A project is laid out like any TypeScript one: components, helpers and
 * models in the directories that suit it. Each file compiles to the Dart file
 * beside it, and an import between them is rewritten to match.
 */
describe('transpileComponent — files beside each other', () => {
  const project = async (
    files: Record<string, string>,
  ): Promise<{ root: string; dartFor: (name: string) => Promise<string> }> => {
    const root = await mkdtemp(join(tmpdir(), 'fsx-layout-'));
    for (const [name, contents] of Object.entries(files)) {
      await Bun.write(join(root, name), contents);
    }
    return {
      root,
      dartFor: async (name): Promise<string> => {
        const filePath = join(root, name);
        return transpileComponent({
          source: await Bun.file(filePath).text(),
          filePath,
        });
      },
    };
  };

  test('data imported from a sibling brings the shape it holds', async () => {
    const { dartFor } = await project({
      'data/albums.tsx':
        'interface Album { id: number; title: string }\n' +
        "export const ALBUMS: Album[] = [{ id: 1, title: 'Kind of Blue' }];\n",
      'App.tsx':
        "import { Column, Text } from 'flutter-tsx';\n" +
        "import { ALBUMS } from './data/albums';\n" +
        'export const App = () => (\n' +
        '  <Column>\n' +
        '    {ALBUMS.map((album) => (\n' +
        '      <Text>{album.title}</Text>\n' +
        '    ))}\n' +
        '  </Column>\n' +
        ');\n',
    });

    const dart = await dartFor('App.tsx');

    // The data's file is imported, its Dart name is used, and the shape it
    // holds is known well enough to read a field off an element.
    expect(dart).toContain("import 'data/albums.dart';");
    expect(dart).toContain('for (final album in albums) Text(album.title)');
  });

  test('a component may render nothing but data from next door', async () => {
    const { dartFor } = await project({
      'data/labels.tsx': "export const TITLE = 'Library';\n",
      'App.tsx':
        "import { Text } from 'flutter-tsx';\n" +
        "import { TITLE } from './data/labels';\n" +
        'export const App = () => <Text>{TITLE}</Text>;\n',
    });

    expect(await dartFor('App.tsx')).toContain('Text(title)');
  });

  test('a helper in another directory is called, and its file imported', async () => {
    const { root, dartFor } = await project({
      'helpers/format.tsx':
        'export const shout = (value: string): string => value.toUpperCase();\n',
      'App.tsx':
        "import { Text } from 'flutter-tsx';\n" +
        "import { shout } from './helpers/format';\n" +
        'export const App = () => <Text>{shout("hi")}</Text>;\n',
    });

    // Without the import the Dart names a function that is not there — which
    // is what it used to emit.
    const dart = await dartFor('App.tsx');
    expect(dart).toContain("import 'helpers/format.dart';");
    expect(dart).toContain("Text(shout('hi'))");

    // And the helper's own file compiles, though it renders nothing.
    expect(await dartFor('helpers/format.tsx')).toContain(
      'String shout(String value) => value.toUpperCase();',
    );

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a file of models compiles to its data classes', async () => {
    const { root, dartFor } = await project({
      'models/album.tsx': 'export interface Album {\n  title: string;\n}\n',
    });

    expect(await dartFor('models/album.tsx')).toContain('class Album {');

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a file of only a store keeps the Flutter import it needs', async () => {
    const { root, dartFor } = await project({
      'stores/session.tsx':
        "import { createStore } from 'flutter-tsx';\n" +
        "export const sessionStore = createStore({ name: 'Ada' });\n",
    });

    // A store extends ChangeNotifier, so this file does need the barrel —
    // unlike one of plain helpers, where the import would be unused and the
    // analyzer would reject it.
    const dart = await dartFor('stores/session.tsx');
    expect(dart).toContain("import 'package:flutter/material.dart';");
    expect(dart).toContain('extends ChangeNotifier');

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a file of only helpers carries no Flutter import', async () => {
    const { root, dartFor } = await project({
      'helpers/format.tsx':
        'export const shout = (value: string): string => value.toUpperCase();\n',
    });

    expect(await dartFor('helpers/format.tsx')).not.toContain(
      'package:flutter',
    );

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a helper imported from a file that is not there is a numbered error', async () => {
    const { root, dartFor } = await project({
      'App.tsx':
        "import { Text } from 'flutter-tsx';\n" +
        "import { shout } from './helpers/format';\n" +
        'export const App = () => <Text>{shout("hi")}</Text>;\n',
    });

    expect(dartFor('App.tsx')).rejects.toThrow(/TSX0336[\s\S]*does not exist/);

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a name the sibling file does not export is a numbered error', async () => {
    const { root, dartFor } = await project({
      'helpers/format.tsx':
        'export const other = (value: string): string => value;\n',
      'App.tsx':
        "import { Text } from 'flutter-tsx';\n" +
        "import { shout } from './helpers/format';\n" +
        'export const App = () => <Text>{shout("hi")}</Text>;\n',
    });

    expect(dartFor('App.tsx')).rejects.toThrow(
      /exports no component or helper named shout/,
    );

    await rm(root, { recursive: true, force: true });
  }, 60000);

  test('a file that declares nothing is a numbered error', async () => {
    const { root, dartFor } = await project({
      'empty.tsx': 'const unused = 1;\n',
    });

    expect(dartFor('empty.tsx')).rejects.toThrow(
      new Error(
        'TSX0103 ' +
          join(root, 'empty.tsx') +
          ':1:1 — this file declares nothing: export a component, a helper, ' +
          'a model, an enum, a store, a router or a constant.',
      ),
    );

    await rm(root, { recursive: true, force: true });
  }, 60000);
});

/**
 * A component says which of a plugin's events it wants by writing the
 * callback; the mixin, the registration and the unregistration follow from
 * that. Nothing about tray_manager is named in the compiler — the shape is
 * derived from the package.
 */
describe('transpileComponent — a plugin that reports through a listener', () => {
  const trayComponent = (body: string): string =>
    "import { Text, useState } from 'flutter-tsx';\n" +
    "import { useTrayManager } from 'plugin:tray_manager';\n" +
    'export const Probe = () => {\n' +
    "  const [label, setLabel] = useState('none');\n" +
    body +
    '  return <Text>{label}</Text>;\n' +
    '};\n';

  test('a component that answers no event carries no mixin', async () => {
    const dart = await transpileComponent({
      source: trayComponent('  const tray = useTrayManager();\n'),
      filePath: 'probe.tsx',
    });

    expect(dart).not.toContain('with TrayListener');
    expect(dart).not.toContain('addListener');
  });

  test('answering an event registers the widget for exactly as long as it lives', async () => {
    const dart = await transpileComponent({
      source: trayComponent(
        '  useTrayManager({\n' +
          "    onTrayIconMouseDown: () => {\n      setLabel('icon');\n    },\n" +
          '  });\n',
      ),
      filePath: 'probe.tsx',
    });

    // The hook's result is not bound to anything: a component may want the
    // events and nothing else, and the callbacks must not be dropped.
    expect(dart).toContain(
      'class _ProbeState extends State<Probe> with TrayListener {',
    );
    expect(dart).toContain(
      '  @override\n' +
        '  void initState() {\n' +
        '    super.initState();\n' +
        '    trayManager.addListener(this);\n' +
        '  }',
    );
    expect(dart).toContain(
      '  @override\n' +
        '  void dispose() {\n' +
        '    trayManager.removeListener(this);\n' +
        '    super.dispose();\n' +
        '  }',
    );
    expect(dart).toContain(
      "  @override\n  void onTrayIconMouseDown() {\n    setState(() {\n      _label = 'icon';\n    });\n  }",
    );
  });

  test('an event body reads the value it is handed', async () => {
    const dart = await transpileComponent({
      source: trayComponent(
        '  useTrayManager({\n' +
          '    onTrayMenuItemClick: (item) => {\n' +
          "      setLabel(item.key ?? 'none');\n" +
          '    },\n' +
          '  });\n',
      ),
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      "  @override\n  void onTrayMenuItemClick(MenuItem item) {\n    setState(() {\n      _label = item.key ?? 'none';\n    });\n  }",
    );
  });

  test('a callback may ignore the value it is handed', async () => {
    const dart = await transpileComponent({
      source: trayComponent(
        '  useTrayManager({\n' +
          "    onTrayMenuItemClick: () => {\n      setLabel('clicked');\n    },\n" +
          '  });\n',
      ),
      filePath: 'probe.tsx',
    });

    // The override still declares what the plugin delivers, named as the
    // plugin names it, because Dart demands the signature match.
    expect(dart).toContain('void onTrayMenuItemClick(MenuItem menuItem) {');
  });

  test('an event given something other than a function is a numbered error', () => {
    expect(
      transpileComponent({
        source: trayComponent(
          "  useTrayManager({ onTrayIconMouseDown: 'yes' });\n",
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0313 probe.tsx:5:20 — onTrayIconMouseDown is an event: give it ' +
          'a function, `onTrayIconMouseDown: () => { … }`.',
      ),
    );
  });
});

/**
 * What a plugin hands back is a value the code names and uses. Extracting a
 * type nothing can reach is the state this suite exists to prevent.
 */
describe('transpileComponent — values a plugin hands back', () => {
  const cameraComponent = (body: string): string =>
    "import { Text, useState } from 'flutter-tsx';\n" +
    "import { useCamera } from 'plugin:camera';\n" +
    'export const Probe = () => {\n' +
    '  const cam = useCamera();\n' +
    "  const [label, setLabel] = useState('none');\n" +
    body +
    '  return <Text onClick={run}>{label}</Text>;\n' +
    '};\n';

  test('a call through a handle that may be null reads null-safely', async () => {
    const dart = await transpileComponent({
      source: cameraComponent(
        '  const run = async () => {\n' +
          '    const photo = await cam?.takePicture();\n' +
          "    setLabel(photo?.path ?? 'cancelled');\n" +
          '  };\n',
      ),
      filePath: 'probe.tsx',
    });

    // `await _cam?.takePicture()` is an `XFile?`, and Dart refuses `.path`
    // on it — so the read carries the same nullability the call has.
    expect(dart).toContain('final photo = await _cam?.takePicture();');
    expect(dart).toContain("_label = photo?.path ?? 'cancelled';");
  });

  test('a guard inside a handler narrows the reads after it', async () => {
    const dart = await transpileComponent({
      source: cameraComponent(
        '  const run = async () => {\n' +
          '    if (!cam) {\n' +
          '      return;\n' +
          '    }\n' +
          '    const photo = await cam.takePicture();\n' +
          '    setLabel(photo.path);\n' +
          '  };\n',
      ),
      filePath: 'probe.tsx',
    });

    // The guard returns, so both the call and the read below it are made on
    // values Dart no longer has to treat as null.
    expect(dart).toContain('    if (_cam == null) {\n      return;\n    }');
    expect(dart).toContain('final photo = await _cam!.takePicture();');
    expect(dart).toContain('_label = photo.path;');
  });

  test('a local declared beside others is in scope for what follows', async () => {
    const dart = await transpileComponent({
      source: cameraComponent(
        '  const run = async () => {\n' +
          '    const photo = await cam?.takePicture();\n' +
          "    const name = photo?.name ?? 'cancelled';\n" +
          '    setLabel(name);\n' +
          '  };\n',
      ),
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("final name = photo?.name ?? 'cancelled';");
    expect(dart).toContain('_label = name;');
  });

  test('declaring several values at once is a numbered error', () => {
    expect(
      transpileComponent({
        source: cameraComponent(
          '  const run = async () => {\n' +
            '    const a = 1, b = 2;\n' +
            '    setLabel(`${a}${b}`);\n' +
            '  };\n',
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305[\s\S]*declare one value at a time/);
  });
});
