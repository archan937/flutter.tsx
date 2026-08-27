@Tags(['sdk'])
library;

import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;
import 'package:test/test.dart';

void main() {
  late PluginApi api;

  setUpAll(() async {
    final projectDir = path.normalize(
      path.join(Directory.current.path, '..', 'test', 'fixtures'),
    );
    final home = Platform.environment['HOME'];
    final flutterRoot =
        Platform.environment['FSX_FLUTTER_ROOT'] ??
        path.join(home ?? '', '.fsx', 'flutter');
    final layout = SdkLayout.resolve(flutterRoot);

    if (!File(path.join(projectDir, '.dart_tool', 'package_config.json'))
        .existsSync()) {
      final result = Process.runSync(path.join(flutterRoot, 'bin', 'flutter'), [
        'pub',
        'get',
      ], workingDirectory: projectDir);
      if (result.exitCode != 0) {
        throw StateError('flutter pub get failed: ${result.stderr}');
      }
    }

    api = await extractPluginApi(
      packageName: 'camera',
      projectDir: projectDir,
      sdkPath: layout.dartSdkPath,
    );
  });

  group('plugin extraction ground truths (camera)', () {
    test('the committed ref/plugins/camera.json is byte-fresh', () {
      final committed = File(
        path.join(
          Directory.current.path,
          '..',
          'ref',
          'plugins',
          'camera.json',
        ),
      ).readAsStringSync();

      expect(committed, encodePluginApi(api));
    });

    test('captures the package identity from the resolved version', () {
      expect(api.package, 'camera');
      expect(api.version, '0.12.0+2');
    });

    test('CameraController keeps its constructor shape', () {
      final controller = api.classes.singleWhere(
        (candidate) => candidate.name == 'CameraController',
      );
      final constructor = controller.constructors.singleWhere(
        (candidate) => candidate.name == '',
      );
      expect(
        constructor.params
            .take(2)
            .map((param) => '${param.display} ${param.name}'),
        ['CameraDescription description', 'ResolutionPreset resolutionPreset'],
      );
      expect(constructor.isConst, false);
    });

    test('lifecycle and capture methods are extracted with signatures', () {
      final controller = api.classes.singleWhere(
        (candidate) => candidate.name == 'CameraController',
      );
      MethodModel methodNamed(String name) =>
          controller.methods.singleWhere((method) => method.name == name);

      expect(methodNamed('initialize').returnType.toJson(), {
        'kind': 'future',
        'item': {'kind': 'void'},
      });
      expect(methodNamed('initialize').params, isEmpty);
      expect(methodNamed('takePicture').returnType.toJson(), {
        'kind': 'future',
        'item': {'kind': 'named', 'name': 'XFile'},
      });
      expect(methodNamed('dispose').returnType.toJson(), {
        'kind': 'future',
        'item': {'kind': 'void'},
      });
    });

    test('the ResolutionPreset enum arrives with every value', () {
      final preset = api.enums.singleWhere(
        (candidate) => candidate.name == 'ResolutionPreset',
      );
      expect(preset.values.map((value) => value.name), [
        'low',
        'medium',
        'high',
        'veryHigh',
        'ultraHigh',
        'max',
      ]);
    });

    test('a package missing from the project is a loud error', () {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      expect(
        extractPluginApi(
          packageName: 'nonexistent_plugin',
          projectDir: projectDir,
        ),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            '"nonexistent_plugin" is not in '
                '$projectDir/.dart_tool/package_config.json — add it to '
                'pubspec.yaml and run flutter pub get.',
          ),
        ),
      );
    });

    test('a path-resolved package without a version is a loud error', () {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      expect(
        extractPluginApi(packageName: 'flutter', projectDir: projectDir),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Could not determine the resolved version of "flutter" from '
                'flutter — only pub-hosted plugins are supported.',
          ),
        ),
      );
    });

    test('a part-file barrel is not a library and errors loudly', () async {
      final temp = Directory.systemTemp.createTempSync('fsx-plugin-part-');
      addTearDown(() => temp.delete(recursive: true));
      final packageDir = Directory(path.join(temp.path, 'partial-1.0.0'))
        ..createSync(recursive: true);
      File(path.join(packageDir.path, 'lib', 'partial.dart'))
        ..createSync(recursive: true)
        ..writeAsStringSync('part of nothing;\n');
      File(path.join(temp.path, '.dart_tool', 'package_config.json'))
        ..createSync(recursive: true)
        ..writeAsStringSync(
          '{"configVersion": 2, "packages": [{"name": "partial", '
          '"rootUri": "${Uri.file(packageDir.path)}", "packageUri": "lib/"}]}',
        );
      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');

      await expectLater(
        extractPluginApi(
          packageName: 'partial',
          projectDir: temp.path,
          sdkPath: SdkLayout.resolve(flutterRoot).dartSdkPath,
        ),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Could not load plugin library package:partial/partial.dart '
                '(NotLibraryButPartResult) — is "partial" a dependency of '
                '${temp.path}?',
          ),
        ),
      );
    });

    test(
      'a package without a real barrel extracts nothing and errors',
      () async {
        final temp = _tempProject(
          '{"configVersion": 2, "packages": [{"name": "ghost", '
          '"rootUri": "file:///nowhere/ghost-1.0.0", "packageUri": "lib/"}]}',
        );
        addTearDown(() => temp.delete(recursive: true));

        await expectLater(
          extractPluginApi(packageName: 'ghost', projectDir: temp.path),
          throwsA(
            isA<StateError>().having(
              (error) => error.message,
              'message',
              'Extracted nothing from package:ghost/ghost.dart — the package '
                  'has no ghost.dart barrel or exports no public API.',
            ),
          ),
        );
      },
    );

    test('a corrupt package_config is a loud error', () async {
      final temp = _tempProject('{"configVersion": 2, "packages": 42}');
      addTearDown(() => temp.delete(recursive: true));
      await expectLater(
        extractPluginApi(packageName: 'x', projectDir: temp.path),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Unreadable package_config.json in ${temp.path}',
          ),
        ),
      );

      final nonMap = _tempProject('[]');
      addTearDown(() => nonMap.delete(recursive: true));
      await expectLater(
        extractPluginApi(packageName: 'x', projectDir: nonMap.path),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            'Unreadable package_config.json in ${nonMap.path}',
          ),
        ),
      );
    });

    test('function parameters extract through a hermetic mini package', () async {
      final temp = Directory.systemTemp.createTempSync('fsx-plugin-mini-');
      addTearDown(() => temp.delete(recursive: true));
      final packageDir = Directory(path.join(temp.path, 'mini-1.0.0'))
        ..createSync(recursive: true);
      File(path.join(packageDir.path, 'lib', 'mini.dart'))
        ..createSync(recursive: true)
        ..writeAsStringSync(
          'Future<void> greet(String name, {int times = 1}) async {}\n',
        );
      File(path.join(temp.path, '.dart_tool', 'package_config.json'))
        ..createSync(recursive: true)
        ..writeAsStringSync(
          '{"configVersion": 2, "packages": [{"name": "mini", '
          '"rootUri": "${Uri.file(packageDir.path)}", "packageUri": "lib/"}]}',
        );

      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');
      final mini = await extractPluginApi(
        packageName: 'mini',
        projectDir: temp.path,
        sdkPath: SdkLayout.resolve(flutterRoot).dartSdkPath,
      );

      expect(mini.version, '1.0.0');
      final greet = mini.functions.singleWhere(
        (candidate) => candidate.name == 'greet',
      );
      expect(greet.params.map((param) => param.toJson()), [
        {
          'name': 'name',
          'type': {'kind': 'scalar', 'name': 'String'},
          'display': 'String',
          'named': false,
          'required': true,
          'defaultValue': null,
          'doc': '',
          'deprecated': false,
        },
        {
          'name': 'times',
          'type': {'kind': 'scalar', 'name': 'int'},
          'display': 'int',
          'named': true,
          'required': false,
          'defaultValue': '1',
          'doc': '',
          'deprecated': false,
        },
      ]);
    });

    test('writePluginApi creates parents and writes the encoded api', () async {
      final temp = Directory.systemTemp.createTempSync('fsx-plugin-out-');
      addTearDown(() => temp.delete(recursive: true));
      const api = PluginApi(
        package: 'demo',
        version: '1.0.0',
        classes: [],
        enums: [
          EnumEntity(
            name: 'Mode',
            library: 'demo',
            doc: '',
            values: [EnumValueModel(name: 'on', doc: '')],
          ),
        ],
        functions: [
          FunctionModel(
            name: 'ping',
            doc: '/// Pings.',
            returnType: VoidTypeNode(),
            params: [],
          ),
        ],
        permissions: PluginPermissions(
          android: AndroidPermissions(
            manifestSource: null,
            permissions: [],
            exampleSource: null,
            querySchemes: [],
          ),
          ios: IosPermissions(
            exampleSource: null,
            usageDescriptionKeys: [],
            querySchemes: [],
          ),
        ),
      );
      final outputPath = path.join(temp.path, 'nested', 'camera.json');

      await writePluginApi(api, outputPath);

      expect(File(outputPath).readAsStringSync(), encodePluginApi(api));
    });

    test('the encoded plugin api document is exact and deterministic', () {
      final api = PluginApi(
        package: 'demo',
        version: '1.2.3',
        classes: const [
          PluginClass(
            name: 'DemoController',
            doc: '/// Controls demos.',
            constructors: [],
            fields: [
              FieldModel(
                name: 'frameRate',
                doc: '/// Frames per second.',
                type: ScalarTypeNode('double'),
              ),
            ],
            methods: [
              MethodModel(
                name: 'run',
                doc: '',
                isStatic: false,
                returnType: FutureTypeNode(VoidTypeNode()),
                params: [],
              ),
            ],
            constants: [],
          ),
        ],
        enums: const [],
        functions: const [],
        permissions: const PluginPermissions(
          android: AndroidPermissions(
            manifestSource: 'demo_android/android/src/main/AndroidManifest.xml',
            permissions: ['android.permission.VIBRATE'],
            exampleSource: null,
            querySchemes: [],
          ),
          ios: IosPermissions(
            exampleSource: null,
            usageDescriptionKeys: [],
            querySchemes: [],
          ),
        ),
      );

      expect(encodePluginApi(api), '''
{
  "package": "demo",
  "version": "1.2.3",
  "classes": [
    {
      "name": "DemoController",
      "doc": "/// Controls demos.",
      "constructors": [],
      "fields": [
        {
          "name": "frameRate",
          "doc": "/// Frames per second.",
          "type": {
            "kind": "scalar",
            "name": "double"
          }
        }
      ],
      "methods": [
        {
          "name": "run",
          "doc": "",
          "static": false,
          "returnType": {
            "kind": "future",
            "item": {
              "kind": "void"
            }
          },
          "params": []
        }
      ],
      "constants": []
    }
  ],
  "enums": [],
  "functions": [],
  "permissions": {
    "android": {
      "manifestSource": "demo_android/android/src/main/AndroidManifest.xml",
      "permissions": [
        "android.permission.VIBRATE"
      ],
      "exampleSource": null,
      "querySchemes": []
    },
    "ios": {
      "exampleSource": null,
      "usageDescriptionKeys": [],
      "querySchemes": []
    }
  }
}
''');
    });

    test('static factory methods are extracted and flagged', () async {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');
      final prefs = await extractPluginApi(
        packageName: 'shared_preferences',
        projectDir: projectDir,
        sdkPath: SdkLayout.resolve(flutterRoot).dartSdkPath,
      );
      final sharedPreferences = prefs.classes.singleWhere(
        (candidate) => candidate.name == 'SharedPreferences',
      );
      final getInstance = sharedPreferences.methods.singleWhere(
        (method) => method.name == 'getInstance',
      );

      expect(getInstance.isStatic, true);
      expect(getInstance.params, isEmpty);
      expect(getInstance.returnType.toJson(), {
        'kind': 'future',
        'item': {'kind': 'named', 'name': 'SharedPreferences'},
      });
      expect(
        sharedPreferences.methods
            .singleWhere((method) => method.name == 'setString')
            .isStatic,
        false,
      );

      final committed = File(
        path.join(
          Directory.current.path,
          '..',
          'ref',
          'plugins',
          'shared_preferences.json',
        ),
      ).readAsStringSync();
      expect(committed, encodePluginApi(prefs));
    });

    test('instance fields and getters are extracted with types', () async {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');
      final layout = SdkLayout.resolve(flutterRoot);
      final info = await extractPluginApi(
        packageName: 'package_info_plus',
        projectDir: projectDir,
        sdkPath: layout.dartSdkPath,
      );
      final packageInfo = info.classes.singleWhere(
        (candidate) => candidate.name == 'PackageInfo',
      );
      FieldModel fieldNamed(String name) =>
          packageInfo.fields.singleWhere((field) => field.name == name);

      expect(fieldNamed('appName').type.toJson(), {
        'kind': 'scalar',
        'name': 'String',
      });
      expect(fieldNamed('version').type.toJson(), {
        'kind': 'scalar',
        'name': 'String',
      });
      expect(fieldNamed('installTime').type.toJson(), {
        'kind': 'nullable',
        'inner': {'kind': 'named', 'name': 'DateTime'},
      });
      expect(fieldNamed('data').type.toJson(), {
        'kind': 'map',
        'key': {'kind': 'scalar', 'name': 'String'},
        'value': {'kind': 'unknown'},
      });
      expect(
        packageInfo.fields.map((field) => field.name),
        isNot(contains('hashCode')),
      );
      expect(
        packageInfo.fields.map((field) => field.name),
        isNot(contains('runtimeType')),
      );
    });

    test('every committed plugin snapshot is byte-fresh', () async {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');
      final layout = SdkLayout.resolve(flutterRoot);
      final pluginsDir = Directory(
        path.join(Directory.current.path, '..', 'ref', 'plugins'),
      );
      final snapshots =
          pluginsDir
              .listSync()
              .whereType<File>()
              .where((file) => file.path.endsWith('.json'))
              .toList()
            ..sort((first, second) => first.path.compareTo(second.path));
      expect(snapshots, isNotEmpty);

      for (final snapshot in snapshots) {
        final packageName = path.basenameWithoutExtension(snapshot.path);
        final extracted = await extractPluginApi(
          packageName: packageName,
          projectDir: projectDir,
          sdkPath: layout.dartSdkPath,
        );
        expect(
          snapshot.readAsStringSync(),
          encodePluginApi(extracted),
          reason:
              '$packageName.json is stale — run '
              '`bun run extract:plugin $packageName`.',
        );
      }
    });

    test('platform manifest requirements come from the real artifacts', () {
      // Android: the resolved default_package's own AndroidManifest.xml —
      // the file Gradle merges into the app.
      expect(
        api.permissions.android.manifestSource,
        contains('camera_android_camerax'),
      );
      expect(api.permissions.android.permissions, [
        'android.permission.CAMERA',
        'android.permission.RECORD_AUDIO',
        'android.permission.WRITE_EXTERNAL_STORAGE',
      ]);
      expect(api.permissions.android.querySchemes, isEmpty);

      // iOS: the plugin's own example app declares the usage-description
      // keys a host app must supply. Only the keys are derivable — the
      // strings are app-specific copy.
      expect(api.permissions.ios.exampleSource, isNotNull);
      expect(api.permissions.ios.usageDescriptionKeys, [
        'NSCameraUsageDescription',
        'NSMicrophoneUsageDescription',
      ]);
    });

    test('host-app query schemes come from the example app manifest', () async {
      final projectDir = path.normalize(
        path.join(Directory.current.path, '..', 'test', 'fixtures'),
      );
      final home = Platform.environment['HOME'];
      final flutterRoot =
          Platform.environment['FSX_FLUTTER_ROOT'] ??
          path.join(home ?? '', '.fsx', 'flutter');
      final launcher = await extractPluginApi(
        packageName: 'url_launcher',
        projectDir: projectDir,
        sdkPath: SdkLayout.resolve(flutterRoot).dartSdkPath,
      );

      // url_launcher needs no permission, but canLaunchUrl does need
      // <queries> entries that manifest merging cannot supply — reporting
      // an empty android requirement here would be a lie.
      expect(launcher.permissions.android.permissions, isEmpty);
      expect(launcher.permissions.android.querySchemes, [
        'https',
        'sms',
        'tel',
      ]);
    });

    test(
      'a plugin with no platform artifacts reports absent sources',
      () async {
        final projectDir = path.normalize(
          path.join(Directory.current.path, '..', 'test', 'fixtures'),
        );
        final home = Platform.environment['HOME'];
        final flutterRoot =
            Platform.environment['FSX_FLUTTER_ROOT'] ??
            path.join(home ?? '', '.fsx', 'flutter');
        final prefs = await extractPluginApi(
          packageName: 'shared_preferences',
          projectDir: projectDir,
          sdkPath: SdkLayout.resolve(flutterRoot).dartSdkPath,
        );

        // An absent source is distinguishable from "declares none" — a null
        // source means no artifact was found, never "no permissions needed".
        expect(prefs.permissions.android.manifestSource, isNotNull);
        expect(prefs.permissions.android.permissions, isEmpty);
        expect(prefs.permissions.android.querySchemes, isEmpty);
        expect(prefs.permissions.ios.usageDescriptionKeys, isEmpty);
      },
    );

    test('top-level functions are extracted with signatures', () {
      final available = api.functions.singleWhere(
        (candidate) => candidate.name == 'availableCameras',
      );
      expect(available.params, isEmpty);
      expect(available.returnType.toJson(), {
        'kind': 'future',
        'item': {
          'kind': 'list',
          'item': {'kind': 'named', 'name': 'CameraDescription'},
        },
      });
    });
  });
  group('readPluginPermissions — synthetic plugin layout', () {
    test('reads every artifact a federated plugin can contribute', () {
      final temp = Directory.systemTemp.createTempSync('fsx-perms-');
      addTearDown(() => temp.delete(recursive: true));

      void write(List<String> segments, String content) {
        File(path.join(temp.path, path.joinAll(segments)))
          ..createSync(recursive: true)
          ..writeAsStringSync(content);
      }

      write(
        ['.dart_tool', 'package_config.json'],
        '{"configVersion": 2, '
        '"packages": [{"name": "faker", "rootUri": "../faker"}, '
        '{"name": "faker_android", "rootUri": "../faker_android"}]}',
      );

      write(
        ['faker', 'pubspec.yaml'],
        [
          'name: faker',
          'flutter:',
          '  plugin:',
          '    platforms:',
          '      android:',
          '        default_package: faker_android',
          '      ios:',
          '        default_package: faker_ios',
          '',
        ].join('\n'),
      );

      write(
        ['faker_android', 'android', 'src', 'main', 'AndroidManifest.xml'],
        [
          '<manifest>',
          '  <uses-permission android:name="android.permission.VIBRATE"/>',
          '  <uses-permission android:name="android.permission.INTERNET"/>',
          '</manifest>',
        ].join('\n'),
      );

      write(
        [
          'faker',
          'example',
          'android',
          'app',
          'src',
          'main',
          'AndroidManifest.xml',
        ],
        [
          '<manifest>',
          '  <queries>',
          '    <intent>',
          '      <data android:scheme="fax" />',
          '    </intent>',
          '  </queries>',
          '  <application>',
          '    <activity>',
          '      <intent-filter>',
          '        <data android:scheme="notaquery" />',
          '      </intent-filter>',
          '    </activity>',
          '  </application>',
          '</manifest>',
        ].join('\n'),
      );

      write(
        ['faker', 'example', 'ios', 'Runner', 'Info.plist'],
        [
          '<plist version="1.0">',
          '<dict>',
          '  <key>NSFakerUsageDescription</key>',
          '  <string>Demo copy</string>',
          '  <key>LSApplicationQueriesSchemes</key>',
          '  <array>',
          '    <string>fax</string>',
          '    <string>telex</string>',
          '  </array>',
          '</dict>',
          '</plist>',
        ].join('\n'),
      );

      final permissions = readPluginPermissions(
        packageName: 'faker',
        projectDir: temp.path,
      );

      expect(
        permissions.android.manifestSource,
        'faker_android/android/src/main/AndroidManifest.xml',
      );
      expect(permissions.android.permissions, [
        'android.permission.INTERNET',
        'android.permission.VIBRATE',
      ]);
      expect(
        permissions.android.exampleSource,
        path.join(
          'example',
          'android',
          'app',
          'src',
          'main',
          'AndroidManifest.xml',
        ),
      );
      // Only <queries> schemes count — an intent-filter scheme says what the
      // app handles, not what it looks up.
      expect(permissions.android.querySchemes, ['fax']);
      expect(permissions.ios.usageDescriptionKeys, ['NSFakerUsageDescription']);
      expect(permissions.ios.querySchemes, ['fax', 'telex']);
    });

    test('an unresolved plugin reports every artifact as absent', () {
      final temp = _tempProject('{"configVersion": 2, "packages": []}');
      addTearDown(() => temp.delete(recursive: true));

      final permissions = readPluginPermissions(
        packageName: 'ghost',
        projectDir: temp.path,
      );

      expect(permissions.android.manifestSource, isNull);
      expect(permissions.android.exampleSource, isNull);
      expect(permissions.ios.exampleSource, isNull);
      expect(permissions.android.querySchemes, isEmpty);
      expect(permissions.ios.querySchemes, isEmpty);
    });

    test('an unreadable package_config is a loud error', () {
      final temp = _tempProject('[]');
      addTearDown(() => temp.delete(recursive: true));

      expect(
        () => readPluginPermissions(packageName: 'x', projectDir: temp.path),
        throwsA(
          isA<StateError>().having(
            (error) => error.message,
            'message',
            contains('Unreadable package_config.json'),
          ),
        ),
      );
    });
  });
}

Directory _tempProject(String configJson) {
  final dir = Directory.systemTemp.createTempSync('fsx-plugin-');
  File(path.join(dir.path, '.dart_tool', 'package_config.json'))
    ..createSync(recursive: true)
    ..writeAsStringSync(configJson);
  return dir;
}
