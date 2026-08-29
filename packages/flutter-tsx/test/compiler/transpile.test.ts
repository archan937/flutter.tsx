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

  test('props on a stateful component are a numbered error', () => {
    expect(
      transpileComponent({
        source:
          "import { Text, useState } from 'flutter-tsx';\n" +
          'export const Probe = ({ label }: { label: string }) => {\n' +
          '  const [count, setCount] = useState(0);\n' +
          '  return <Text>{label}</Text>;\n' +
          '};\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      new Error(
        'TSX0310 probe.tsx:2:14 — <Probe> combines props and state — ' +
          'stateful components with props land at a later roadmap step.',
      ),
    );
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

class _SettingsStore extends ChangeNotifier {
  _SettingsStore({
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

final _SettingsStore _settingsStore = _SettingsStore(
  firstUserFacingLabel: 'one',
  secondUserFacingLabel: 'two',
  thirdUserFacingLabel: 'three',
);

class Settings extends StatelessWidget {
  const Settings({super.key});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _settingsStore,
      builder: (context, child) {
        return Text(_settingsStore.firstUserFacingLabel);
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
        '  return <Text semanticsLabel={info.appName}>hi</Text>;\n' +
        '};\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      "    return Text('hi', semanticsLabel: _info?.appName ?? '');",
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
        'TSX0305 probe.tsx:2:35 — this expression is not compiled yet ' +
          '(roadmap step 18).',
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
        'TSX0305 probe.tsx:3:25 — this expression is not compiled yet ' +
          '(roadmap step 18).',
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
