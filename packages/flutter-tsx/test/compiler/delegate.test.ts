import { describe, expect, test } from 'bun:test';

import type { ApiSnapshot } from '@src/api/model';
import { analyzeSource } from '@src/compiler/analyze';
import { buildCompileContext, lowerDelegate } from '@src/compiler/lower';
import { transpileComponent } from '@src/compiler/transpile';
import { classEntity } from '@test/support/entities';

/**
 * The classes an app writes itself, and everything the compiler refuses.
 *
 * `defineDelegate` writes a Dart subclass, so what it is given has to match
 * the class the SDK declares: the name has to be one an app really writes,
 * every abstract member has to be written, and nothing else may be.
 */
const probe = (declaration: string, tag = '<Text>hi</Text>'): string =>
  "import { defineDelegate, Text } from 'flutter-tsx';\n" +
  `${declaration}\n` +
  `export const Probe = () => ${tag};\n`;

describe('defineDelegate — what the compiler writes', () => {
  test('a member may reach for a library, and the file imports it', async () => {
    const dart = await transpileComponent({
      source: probe(
        "const sticky = defineDelegate('SliverPersistentHeaderDelegate', {\n" +
          '  minExtent: () => Math.min(48, 96),\n' +
          '  maxExtent: () => 96,\n' +
          '  shouldRebuild: () => false,\n' +
          '  build: () => <Text>Header</Text>,\n' +
          '});',
      ),
      filePath: 'probe.tsx',
    });

    expect(dart).toContain("import 'dart:math' as math;");
    expect(dart).toContain('double get minExtent => math.min(48, 96);');
  });

  test('Dart names the class and its instance its own way', async () => {
    // `SCREAMING_CASE` is how TypeScript writes a constant and not how Dart
    // does: `camel_case_types` wants `_TableSource`, and
    // `non_constant_identifier_names` wants `_tableSource` holding it.
    const dart = await transpileComponent({
      source:
        "import { defineDelegate, PaginatedDataTable, DataColumn, Text } from 'flutter-tsx';\n" +
        "const TABLE_SOURCE = defineDelegate('DataTableSource', {\n" +
        '  rowCount: () => 0,\n' +
        '  isRowCountApproximate: () => false,\n' +
        '  selectedRowCount: () => 0,\n' +
        '  getRow: () => null,\n' +
        '});\n' +
        'export const Probe = () => (\n' +
        '  <PaginatedDataTable\n' +
        '    source={TABLE_SOURCE}\n' +
        '    columns={[new DataColumn({ label: <Text>Step</Text> })]}\n' +
        '  />\n' +
        ');\n',
      filePath: 'probe.tsx',
    });

    expect(dart).toContain('class _TableSource extends DataTableSource {');
    expect(dart).toContain('final _TableSource _tableSource = _TableSource();');
    expect(dart).toContain('source: _tableSource,');
  });

  test('a member handed a callback declares its Dart function type', async () => {
    // `SnapshotPainter.paint` is handed the painter to call — a
    // `void Function(PaintingContext, Offset)` — and an override that typed
    // it as anything else would not be one.
    const dart = await transpileComponent({
      source: probe(
        "const snapshot = defineDelegate('SnapshotPainter', {\n" +
          '  paint: () => {},\n' +
          '  paintSnapshot: () => {},\n' +
          '  shouldRepaint: () => false,\n' +
          '});',
      ),
      filePath: 'probe.tsx',
    });

    expect(dart).toContain(
      'void paint(\n' +
        '    PaintingContext context,\n' +
        '    Offset offset,\n' +
        '    Size size,\n' +
        '    void Function(PaintingContext, Offset) painter,\n' +
        '  ) {}',
    );
  });

  test('the class being written is named as a string', () => {
    expect(
      transpileComponent({
        source: probe(
          'const name = 1;\n' +
            'const sticky = defineDelegate(name, { minExtent: () => 1 });',
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0360/);
  });

  test('the members are written as one object', () => {
    expect(
      transpileComponent({
        source: probe(
          "const sticky = defineDelegate('SliverPersistentHeaderDelegate', 1);",
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0361/);
  });

  test('a written member is an arrow function', () => {
    expect(
      transpileComponent({
        source: probe(
          "const flow = defineDelegate('FlowDelegate', { paintChildren: 1 });",
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0362/);
  });

  test('only a class an app really writes can be written', () => {
    // A `Text` is built, not written; saying otherwise would emit a subclass
    // of something that needs none.
    expect(
      transpileComponent({
        source: probe("const odd = defineDelegate('Text', {});"),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0363.*`Text` is not a class an app writes/);
  });

  test('every abstract member has to be written', () => {
    expect(
      transpileComponent({
        source: probe(
          "const flow = defineDelegate('FlowDelegate', {\n" +
            '  paintChildren: () => {},\n' +
            '});',
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      /TSX0364.*writing a `FlowDelegate` means writing `shouldRepaint` too/,
    );
  });

  test('a member the class does not have is refused', () => {
    expect(
      transpileComponent({
        source: probe(
          "const flow = defineDelegate('FlowDelegate', {\n" +
            '  paintChildren: () => {},\n' +
            '  shouldRepaint: () => false,\n' +
            '  paintNothing: () => {},\n' +
            '});',
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0365.*does not write `paintNothing`/);
  });

  test('two names that become one Dart class are refused', () => {
    expect(
      transpileComponent({
        source: probe(
          "const flow = defineDelegate('FlowDelegate', {\n" +
            '  paintChildren: () => {},\n' +
            '  shouldRepaint: () => false,\n' +
            '});\n' +
            "const Flow = defineDelegate('FlowDelegate', {\n" +
            '  paintChildren: () => {},\n' +
            '  shouldRepaint: () => false,\n' +
            '});',
        ),
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0367.*both become the Dart class `_Flow`/);
  });

  test('a method on a value the SDK does not build is refused', () => {
    // A `WidgetStateColor` answers to `computeLuminance`, and nothing builds
    // one plainly: the call is refused rather than emitted as Dart naming
    // something that does not exist there.
    expect(
      transpileComponent({
        source:
          "import { Opacity, Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Opacity opacity={new WidgetStateColor().computeLuminance()}>\n' +
          '    <Text>hi</Text>\n' +
          '  </Opacity>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(
      /TSX0305.*`new WidgetStateColor\(\).computeLuminance\(\)` is an expression/,
    );
  });

  test('a method on a value nothing builds is refused, not guessed', () => {
    // `MultiChildLayoutDelegate` is written, never constructed, so a call on
    // a fresh one is not a value the compiler can write.
    expect(
      transpileComponent({
        source:
          "import { Text } from 'flutter-tsx';\n" +
          'export const Probe = () => (\n' +
          '  <Text>{new MultiChildLayoutDelegate().hasChild("a")}</Text>\n' +
          ');\n',
        filePath: 'probe.tsx',
      }),
    ).rejects.toThrow(/TSX0305/);
  });
});

describe('a written class fills in its own type parameters', () => {
  test('a member typed by one is written with what fills it', () => {
    // `class _Held extends HeldDelegate<Listenable>` is what the class says
    // it is, so `TValue` inside it is a `Listenable` — wherever it stands.
    const snapshot: ApiSnapshot = {
      meta: {
        frameworkVersion: '3.47.1',
        dartSdkVersion: '3.13.1',
        frameworkRevision: 'abc123',
      },
      hierarchy: {},
      exports: {},
      entities: [
        classEntity('HeldDelegate', {
          isAbstract: true,
          typeParams: ['TValue'],
          typeParamBounds: ['Listenable'],
          abstractMethods: [
            {
              name: 'read',
              doc: '',
              returnType: {
                kind: 'list',
                item: { kind: 'typeVar', name: 'TValue' },
              },
              params: [
                {
                  name: 'value',
                  type: {
                    kind: 'nullable',
                    inner: { kind: 'typeVar', name: 'TValue' },
                  },
                  display: 'TValue?',
                  named: false,
                  required: true,
                  defaultValue: null,
                  doc: '',
                  deprecated: false,
                },
                {
                  name: 'others',
                  type: {
                    kind: 'named',
                    name: 'ValueNotifier',
                    args: [{ kind: 'typeVar', name: 'TValue' }],
                  },
                  display: 'ValueNotifier<TValue>',
                  named: false,
                  required: true,
                  defaultValue: null,
                  doc: '',
                  deprecated: false,
                },
                {
                  name: 'byName',
                  type: {
                    kind: 'map',
                    key: { kind: 'scalar', name: 'String' },
                    value: { kind: 'typeVar', name: 'TValue' },
                  },
                  display: 'Map<String, TValue>',
                  named: false,
                  required: true,
                  defaultValue: null,
                  doc: '',
                  deprecated: false,
                },
              ],
            },
          ],
        }),
      ],
    };
    const source =
      "import { defineDelegate, Text } from 'flutter-tsx';\n" +
      "const held = defineDelegate('HeldDelegate', { read: () => [] });\n" +
      'export const Probe = () => <Text>hi</Text>;\n';
    const analysis = analyzeSource(source, 'probe.tsx');
    const [binding] = analysis.delegates;
    if (binding === undefined) throw new Error('the delegate was not analyzed');

    const delegate = lowerDelegate(
      binding,
      buildCompileContext(snapshot, {}),
      () => undefined,
    );

    expect(delegate.superclass).toBe('HeldDelegate<Listenable>');
    expect(delegate.members[0]?.returnDartType).toBe('List<Listenable>');
    expect(delegate.members[0]?.params).toEqual([
      { name: 'value', dartType: 'Listenable?' },
      { name: 'others', dartType: 'ValueNotifier<Listenable>' },
      { name: 'byName', dartType: 'Map<String, Listenable>' },
    ]);
  });
});

describe('a member whose type has no Dart to write', () => {
  test('is refused, rather than written as something else', () => {
    // Nothing in Flutter 3.47 needs this — every member of every written
    // class is nameable — and a future SDK adding one has to be told about
    // it rather than handed `Object` and a broken override.
    const snapshot: ApiSnapshot = {
      meta: {
        frameworkVersion: '3.47.1',
        dartSdkVersion: '3.13.1',
        frameworkRevision: 'abc123',
      },
      hierarchy: {},
      exports: {},
      entities: [
        classEntity('OddDelegate', {
          isAbstract: true,
          abstractMethods: [
            {
              name: 'read',
              doc: '',
              // `dynamic` is what the extractor calls unknown, and no
              // parameter of a written override may be one.
              returnType: { kind: 'unknown' },
              params: [],
            },
          ],
        }),
      ],
    };
    const source =
      "import { defineDelegate, Text } from 'flutter-tsx';\n" +
      "const odd = defineDelegate('OddDelegate', { read: () => 1 });\n" +
      'export const Probe = () => <Text>hi</Text>;\n';
    const analysis = analyzeSource(source, 'probe.tsx');
    const [binding] = analysis.delegates;
    if (binding === undefined) throw new Error('the delegate was not analyzed');

    expect(() =>
      lowerDelegate(
        binding,
        buildCompileContext(snapshot, {}),
        () => undefined,
      ),
    ).toThrow(/TSX0368.*`OddDelegate.read` is typed with something/);
  });
});
