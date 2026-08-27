import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as path;

import 'api_model.dart';

/// Reads the platform manifest requirements of a plugin from the real
/// artifacts in its resolved package: the implementation package's Android
/// manifest (merged into the host app by Gradle) and the plugin's own example
/// app Info.plist (where its author demonstrates the iOS usage-description
/// keys a host app must supply).
PluginPermissions readPluginPermissions({
  required String packageName,
  required String projectDir,
}) {
  final roots = _packageRoots(projectDir);
  final pluginRoot = roots[packageName];
  final defaults = pluginRoot == null
      ? const <String, String>{}
      : _defaultPackages(pluginRoot);

  return PluginPermissions(
    android: _androidPermissions(
      roots,
      pluginRoot,
      defaults['android'] ?? packageName,
    ),
    ios: _iosPermissions(pluginRoot),
  );
}

Map<String, String> _packageRoots(String projectDir) {
  final configFile = File(
    path.join(projectDir, '.dart_tool', 'package_config.json'),
  );
  final config = jsonDecode(configFile.readAsStringSync());
  final packages = config is Map<String, Object?> ? config['packages'] : null;
  if (packages is! List) {
    throw StateError('Unreadable package_config.json in $projectDir');
  }
  final roots = <String, String>{};
  for (final entry in packages) {
    if (entry is! Map<String, Object?>) {
      continue;
    }
    final name = entry['name'];
    final rootUri = entry['rootUri'];
    if (name is String && rootUri is String) {
      roots[name] = path.normalize(
        path.join(
          projectDir,
          '.dart_tool',
          Uri.parse(rootUri).toFilePath(windows: false),
        ),
      );
    }
  }
  return roots;
}

/// The `flutter: plugin: platforms:` block names the implementation package
/// per platform — the authority for where the manifest lives.
Map<String, String> _defaultPackages(String pluginRoot) {
  final pubspec = File(path.join(pluginRoot, 'pubspec.yaml'));
  if (!pubspec.existsSync()) {
    return const {};
  }
  final defaults = <String, String>{};
  String? platform;
  for (final raw in pubspec.readAsLinesSync()) {
    final line = raw.trimRight();
    final platformMatch = RegExp(r'^      (\w+):\s*$').firstMatch(line);
    if (platformMatch != null) {
      platform = platformMatch.group(1);
      continue;
    }
    final defaultMatch = RegExp(r'^        default_package:\s*(\S+)\s*$')
        .firstMatch(line);
    if (defaultMatch != null && platform != null) {
      defaults[platform] = defaultMatch.group(1)!;
    }
  }
  return defaults;
}

List<String> _sortedMatches(String content, RegExp pattern) =>
    pattern.allMatches(content).map((match) => match.group(1)!).toSet().toList()
      ..sort();

File? _existing(String? root, List<String> segments) {
  if (root == null) {
    return null;
  }
  final file = File(path.join(root, path.joinAll(segments)));
  return file.existsSync() ? file : null;
}

const _exampleAndroidManifest = [
  'example',
  'android',
  'app',
  'src',
  'main',
  'AndroidManifest.xml',
];

const _exampleIosPlist = ['example', 'ios', 'Runner', 'Info.plist'];

AndroidPermissions _androidPermissions(
  Map<String, String> roots,
  String? pluginRoot,
  String implementationPackage,
) {
  final manifest = _existing(roots[implementationPackage], [
    'android',
    'src',
    'main',
    'AndroidManifest.xml',
  ]);
  final example = _existing(pluginRoot, _exampleAndroidManifest);
  final queries = example == null
      ? const <String>[]
      : _queriesSchemes(example.readAsStringSync());
  return AndroidPermissions(
    manifestSource: manifest == null
        ? null
        : '$implementationPackage/android/src/main/AndroidManifest.xml',
    permissions: manifest == null
        ? const []
        : _sortedMatches(
            manifest.readAsStringSync(),
            RegExp(r'<uses-permission[^>]*android:name\s*=\s*"([^"]+)"'),
          ),
    exampleSource: example == null
        ? null
        : path.joinAll(_exampleAndroidManifest),
    querySchemes: queries,
  );
}

/// Only schemes inside `<queries>` count — a scheme on the app's own
/// `<intent-filter>` says what the app handles, not what it looks up.
List<String> _queriesSchemes(String manifest) {
  final block = RegExp(
    r'<queries>(.*?)</queries>',
    dotAll: true,
  ).firstMatch(manifest);
  return block == null
      ? const []
      : _sortedMatches(
          block.group(1)!,
          RegExp(r'android:scheme\s*=\s*"([^"]+)"'),
        );
}

IosPermissions _iosPermissions(String? pluginRoot) {
  final plist = _existing(pluginRoot, _exampleIosPlist);
  if (plist == null) {
    return const IosPermissions(
      exampleSource: null,
      usageDescriptionKeys: [],
      querySchemes: [],
    );
  }
  final content = plist.readAsStringSync();
  return IosPermissions(
    exampleSource: path.joinAll(_exampleIosPlist),
    usageDescriptionKeys: _sortedMatches(
      content,
      RegExp(r'<key>(NS\w*UsageDescription)</key>'),
    ),
    querySchemes: _plistStringArray(content, 'LSApplicationQueriesSchemes'),
  );
}

List<String> _plistStringArray(String content, String key) {
  final block = RegExp(
    '<key>$key</key>\\s*<array>(.*?)</array>',
    dotAll: true,
  ).firstMatch(content);
  return block == null
      ? const []
      : _sortedMatches(block.group(1)!, RegExp(r'<string>([^<]+)</string>'));
}
