import 'dart:convert';
import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;
import 'package:test/test.dart';

void main() {
  late Directory flutterRoot;

  Future<void> writeVersionFile(Object content) async {
    final versionFile = File(
      path.join(flutterRoot.path, 'bin', 'cache', 'flutter.version.json'),
    );
    await versionFile.parent.create(recursive: true);
    await versionFile.writeAsString(jsonEncode(content));
  }

  Matcher throwsStateErrorWith(Object message) => throwsA(
    isA<StateError>().having((error) => error.message, 'message', message),
  );

  setUp(() async {
    flutterRoot = await Directory.systemTemp.createTemp('fsx-sdk-layout-');
    await Directory(path.join(flutterRoot.path, 'packages', 'flutter', 'lib'))
        .create(recursive: true);
    await Directory(path.join(flutterRoot.path, 'bin', 'cache', 'dart-sdk'))
        .create(recursive: true);
    final skyEngine = File(
      path.join(
        flutterRoot.path,
        'bin',
        'cache',
        'pkg',
        'sky_engine',
        'lib',
        'ui',
        'ui.dart',
      ),
    );
    await skyEngine.parent.create(recursive: true);
    await skyEngine.writeAsString('// dart:ui');
    // The embedder file is what the mapping has to lead to.
    await File(
      path.join(
        flutterRoot.path,
        'bin',
        'cache',
        'pkg',
        'sky_engine',
        'lib',
        '_embedder.yaml',
      ),
    ).writeAsString('embedded_libs:\n  "dart:ui": "ui/ui.dart"\n');
    final packageConfig = File(
      path.join(flutterRoot.path, '.dart_tool', 'package_config.json'),
    );
    await packageConfig.parent.create(recursive: true);
    await packageConfig.writeAsString(
      jsonEncode({
        'configVersion': 2,
        'packages': [
          {'name': 'sky_engine', 'rootUri': '../bin/cache/pkg/sky_engine'},
        ],
      }),
    );
  });

  tearDown(() async {
    await flutterRoot.delete(recursive: true);
  });

  group('SdkLayout.resolve', () {
    test('resolves lib path, dart-sdk path, and version meta', () async {
      await writeVersionFile({
        'frameworkVersion': '3.47.1',
        'dartSdkVersion': '3.13.1',
        'frameworkRevision': 'abc123',
      });

      final layout = SdkLayout.resolve(flutterRoot.path);

      expect(
        layout.flutterLibPath,
        path.join(flutterRoot.path, 'packages', 'flutter', 'lib'),
      );
      expect(
        layout.dartSdkPath,
        path.join(flutterRoot.path, 'bin', 'cache', 'dart-sdk'),
      );
      expect(layout.meta.frameworkVersion, '3.47.1');
      expect(layout.meta.dartSdkVersion, '3.13.1');
      expect(layout.meta.frameworkRevision, 'abc123');
    });

    test('rejects a root without the flutter package sources', () async {
      await Directory(path.join(flutterRoot.path, 'packages'))
          .delete(recursive: true);

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          'Flutter sources not found at '
          '${path.join(flutterRoot.path, 'packages', 'flutter', 'lib')} '
          '(expected <flutter-root>/packages/flutter/lib) — run '
          '`fsx install` first.',
        ),
      );
    });

    test('rejects a root without the bootstrapped Dart SDK cache', () async {
      await Directory(path.join(flutterRoot.path, 'bin', 'cache', 'dart-sdk'))
          .delete(recursive: true);

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          'Dart SDK cache not found at '
          '${path.join(flutterRoot.path, 'bin', 'cache', 'dart-sdk')} — run '
          'any flutter command (e.g. `flutter --version`) once to bootstrap '
          'it.',
        ),
      );
    });

    test('rejects a root whose packages are not resolved for analysis', () async {
      await Directory(path.join(flutterRoot.path, '.dart_tool'))
          .delete(recursive: true);

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          'Package resolution not found at '
          '${path.join(flutterRoot.path, '.dart_tool', 'package_config.json')}'
          ' — without it dart:ui types (VoidCallback, …) resolve as invalid. '
          'Run `flutter update-packages` in ${flutterRoot.path} first.',
        ),
      );
    });

    test('rejects a root without a version file', () {
      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          'Version metadata not found at '
          '${path.join(flutterRoot.path, 'bin', 'cache', 'flutter.version.json')}'
          ' (flutter.version.json) — run any flutter command once to create '
          'it.',
        ),
      );
    });

    test('rejects a version file that is not a JSON object', () async {
      await writeVersionFile([1, 2, 3]);

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          '${path.join(flutterRoot.path, 'bin', 'cache', 'flutter.version.json')}'
          ' does not contain a JSON object.',
        ),
      );
    });

    test('rejects a version file missing required fields', () async {
      await writeVersionFile({'frameworkVersion': '3.47.1'});

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(
          '${path.join(flutterRoot.path, 'bin', 'cache', 'flutter.version.json')}'
          ' is missing a string "dartSdkVersion" field.',
        ),
      );
    });

    test(
      'reports engine sources the Flutter cache has not populated',
      () async {
        await writeVersionFile({
          'frameworkVersion': '3.47.1',
          'dartSdkVersion': '3.13.1',
          'frameworkRevision': 'abc123',
        });
        final skyEngine = Directory(
          path.join(flutterRoot.path, 'bin', 'cache', 'pkg'),
        );
        await skyEngine.delete(recursive: true);

        expect(
          () => SdkLayout.resolve(flutterRoot.path),
          throwsStateErrorWith(
            contains('Run `flutter precache` once to populate the cache.'),
          ),
        );
      },
    );

    test('reports a package config that does not map the engine', () async {
      await writeVersionFile({
        'frameworkVersion': '3.47.1',
        'dartSdkVersion': '3.13.1',
        'frameworkRevision': 'abc123',
      });
      await File(
        path.join(flutterRoot.path, '.dart_tool', 'package_config.json'),
      ).writeAsString('{"configVersion": 2, "packages": []}');

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(contains('does not map sky_engine')),
      );
    });

    test('reports a package config that is not an object', () async {
      await writeVersionFile({
        'frameworkVersion': '3.47.1',
        'dartSdkVersion': '3.13.1',
        'frameworkRevision': 'abc123',
      });
      await File(
        path.join(flutterRoot.path, '.dart_tool', 'package_config.json'),
      ).writeAsString('[]');

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(contains('does not map sky_engine')),
      );
    });

    test('reports a package config whose packages are not a list', () async {
      await writeVersionFile({
        'frameworkVersion': '3.47.1',
        'dartSdkVersion': '3.13.1',
        'frameworkRevision': 'abc123',
      });
      await File(
        path.join(flutterRoot.path, '.dart_tool', 'package_config.json'),
      ).writeAsString('{"configVersion": 2, "packages": {}}');

      expect(
        () => SdkLayout.resolve(flutterRoot.path),
        throwsStateErrorWith(contains('does not map sky_engine')),
      );
    });
  });
}
