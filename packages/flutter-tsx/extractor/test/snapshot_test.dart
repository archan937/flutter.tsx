import 'dart:convert';
import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;
import 'package:test/test.dart';

import 'support/fixture_extraction.dart';

void main() {
  group('encodeSnapshot', () {
    final snapshot = ApiSnapshot(
      meta: const SdkMeta(
        frameworkVersion: '3.47.1',
        dartSdkVersion: '3.13.1',
        frameworkRevision: 'abc123',
      ),
      hierarchy: const {
        'Zeta': <String>[],
        'Alpha': ['Base'],
      },
      exports: const {
        'Zeta': ['material'],
        'Alpha': ['widgets', 'material'],
      },
      entities: [
        EnumEntity(
          name: 'Zeta',
          library: 'material',
          doc: '',
          values: const [EnumValueModel(name: 'one', doc: '')],
        ),
        ClassEntity(
          name: 'Alpha',
          library: 'widgets',
          doc: '',
          supertypes: const [],
          constructors: const [],
          constants: const [],
        ),
      ],
    );

    test('encodes the complete, name-sorted, timestamp-free document', () {
      const expected = '''
{
  "meta": {
    "frameworkVersion": "3.47.1",
    "dartSdkVersion": "3.13.1",
    "frameworkRevision": "abc123"
  },
  "hierarchy": {
    "Alpha": [
      "Base"
    ],
    "Zeta": []
  },
  "exports": {
    "Alpha": [
      "widgets",
      "material"
    ],
    "Zeta": [
      "material"
    ]
  },
  "entities": [
    {
      "kind": "class",
      "name": "Alpha",
      "library": "widgets",
      "doc": "",
      "supertypes": [],
      "constructors": [],
      "constants": []
    },
    {
      "kind": "enum",
      "name": "Zeta",
      "library": "material",
      "doc": "",
      "values": [
        {
          "name": "one",
          "doc": ""
        }
      ]
    }
  ]
}
''';
      expect(encodeSnapshot(snapshot), expected);
    });
  });

  group('writeSnapshot', () {
    test(
      'creates parent directories and writes the encoded snapshot',
      () async {
        final tempDir = await Directory.systemTemp.createTemp('fsx-snapshot-');
        addTearDown(() => tempDir.delete(recursive: true));
        final outputPath = path.join(tempDir.path, 'nested', 'api.json');
        final snapshot = ApiSnapshot(
          meta: const SdkMeta(
            frameworkVersion: '3.47.1',
            dartSdkVersion: '3.13.1',
            frameworkRevision: 'abc123',
          ),
          hierarchy: const {},
          exports: const {},
          entities: const [],
        );

        await writeSnapshot(snapshot, outputPath);

        expect(File(outputPath).readAsStringSync(), encodeSnapshot(snapshot));
      },
    );
  });

  group('extractLibrary failures', () {
    test('rejects a file URI that does not exist instead of silently '
        'extracting nothing', () async {
      final tempDir = await Directory.systemTemp.createTemp('fsx-badlib-');
      addTearDown(() => tempDir.delete(recursive: true));

      expect(
        extractLibrary(
          libraryUri: Uri.file(path.join(tempDir.path, 'missing.dart'))
              .toString(),
          includedPaths: [tempDir.path],
          libraryLabel: 'missing',
        ),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Library file not found: '
                '${path.join(tempDir.path, 'missing.dart')} — a missing '
                'library must fail loudly, never extract as empty.',
          ),
        ),
      );
    });

    test('rejects an unresolvable library URI', () async {
      final tempDir = await Directory.systemTemp.createTemp('fsx-badlib-');
      addTearDown(() => tempDir.delete(recursive: true));
      await File(path.join(tempDir.path, 'anchor.dart')).writeAsString('');

      expect(
        extractLibrary(
          libraryUri: 'package:definitely_not_a_real_package/missing.dart',
          includedPaths: [tempDir.path],
          libraryLabel: 'missing',
        ),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            allOf(
              startsWith(
                'Could not load library '
                'package:definitely_not_a_real_package/missing.dart '
                '(CannotResolveUriResult)',
              ),
              // The context is named, so a failure says what was analyzed
              // rather than only what could not be found.
              contains('sdkPath='),
              contains('includedPaths=[${tempDir.path}]'),
              contains('context root ${tempDir.path}'),
              contains('package config '),
            ),
          ),
        ),
      );
    });
  });

  group('determinism', () {
    test('extracting the same library twice yields identical JSON', () async {
      final first = await extractFixtureEntitiesFresh();
      final second = await extractFixtureEntitiesFresh();

      String encode(LibraryExtraction extraction) => jsonEncode({
        'hierarchy': extraction.hierarchy,
        'entities': extraction.entities
            .map((entity) => entity.toJson())
            .toList(),
      });

      expect(encode(first), encode(second));
    });
  });
}
