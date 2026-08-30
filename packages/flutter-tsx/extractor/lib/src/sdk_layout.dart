import 'dart:convert';
import 'dart:io';

import 'package:path/path.dart' as path;

import 'api_model.dart';

class SdkLayout {
  const SdkLayout({
    required this.flutterRoot,
    required this.flutterLibPath,
    required this.dartSdkPath,
    required this.meta,
  });

  final String flutterRoot;
  final String flutterLibPath;
  final String dartSdkPath;
  final SdkMeta meta;

  static SdkLayout resolve(String flutterRoot) {
    final normalizedRoot = path.normalize(flutterRoot);
    final flutterLibPath = path.join(
      normalizedRoot,
      'packages',
      'flutter',
      'lib',
    );
    if (!Directory(flutterLibPath).existsSync()) {
      throw StateError(
        'Flutter sources not found at $flutterLibPath (expected '
        '<flutter-root>/packages/flutter/lib) — run `fsx install` first.',
      );
    }

    final dartSdkPath = path.join(normalizedRoot, 'bin', 'cache', 'dart-sdk');
    if (!Directory(dartSdkPath).existsSync()) {
      throw StateError(
        'Dart SDK cache not found at $dartSdkPath — run any flutter command '
        '(e.g. `flutter --version`) once to bootstrap it.',
      );
    }

    // dart:ui is not in the Dart SDK: it comes from the engine package the
    // Flutter cache holds. Without it every dart:ui type resolves as invalid,
    // which reads downstream as a missing enum rather than a missing SDK.
    final skyEnginePath = path.join(
      normalizedRoot,
      'bin',
      'cache',
      'pkg',
      'sky_engine',
      'lib',
      'ui',
      'ui.dart',
    );
    if (!File(skyEnginePath).existsSync()) {
      throw StateError(
        'Engine sources not found at $skyEnginePath — dart:ui cannot be '
        'analyzed without them. Run `flutter precache` once to populate the '
        'cache.',
      );
    }

    final packageConfigPath = path.join(
      normalizedRoot,
      '.dart_tool',
      'package_config.json',
    );
    final packageConfigFile = File(packageConfigPath);
    if (!packageConfigFile.existsSync()) {
      throw StateError(
        'Package resolution not found at $packageConfigPath — without it '
        'dart:ui types (VoidCallback, …) resolve as invalid. Run '
        '`flutter update-packages` in $normalizedRoot first.',
      );
    }
    // dart:ui resolves through the engine package this config maps: the
    // analyzer finds sky_engine's _embedder.yaml that way. A config without
    // it parses and resolves everything else, and then fails on dart:ui with
    // an unresolved URI rather than anything naming the cause.
    if (!_mapsSkyEngine(packageConfigFile)) {
      throw StateError(
        'Package resolution at $packageConfigPath does not map sky_engine to '
        'an engine with lib/_embedder.yaml — dart:ui cannot be resolved '
        'without it. Run `flutter update-packages` in $normalizedRoot first.',
      );
    }

    return SdkLayout(
      flutterRoot: normalizedRoot,
      flutterLibPath: flutterLibPath,
      dartSdkPath: dartSdkPath,
      meta: _readMeta(normalizedRoot),
    );
  }

  /// Whether the config maps sky_engine to a directory that actually holds
  /// the engine's embedder file. A name alone is not enough: the mapping is
  /// what the analyzer follows to find `_embedder.yaml`, and that is what
  /// makes `dart:ui` resolvable.
  static bool _mapsSkyEngine(File packageConfig) {
    final decoded = jsonDecode(packageConfig.readAsStringSync());
    if (decoded is! Map<String, dynamic>) {
      return false;
    }
    final packages = decoded['packages'];
    if (packages is! List) {
      return false;
    }
    for (final package in packages) {
      if (package is! Map<String, dynamic> || package['name'] != 'sky_engine') {
        continue;
      }
      final rootUri = package['rootUri'];
      if (rootUri is! String) {
        return false;
      }
      // package_config rootUris carry no trailing slash, and resolving a
      // relative path against a slashless URI drops its last segment.
      final root = packageConfig.parent.uri.resolve(
        rootUri.endsWith('/') ? rootUri : '$rootUri/',
      );
      return File.fromUri(root.resolve('lib/_embedder.yaml')).existsSync();
    }
    return false;
  }

  static SdkMeta _readMeta(String flutterRoot) {
    final versionFile = File(
      path.join(flutterRoot, 'bin', 'cache', 'flutter.version.json'),
    );
    if (!versionFile.existsSync()) {
      throw StateError(
        'Version metadata not found at ${versionFile.path} '
        '(flutter.version.json) — run any flutter command once to create it.',
      );
    }

    final content = jsonDecode(versionFile.readAsStringSync());
    if (content is! Map<String, Object?>) {
      throw StateError('${versionFile.path} does not contain a JSON object.');
    }

    return SdkMeta(
      frameworkVersion: _requireString(
        content,
        'frameworkVersion',
        versionFile,
      ),
      dartSdkVersion: _requireString(content, 'dartSdkVersion', versionFile),
      frameworkRevision: _requireString(
        content,
        'frameworkRevision',
        versionFile,
      ),
    );
  }

  static String _requireString(
    Map<String, Object?> content,
    String key,
    File source,
  ) {
    final value = content[key];
    if (value is! String) {
      throw StateError('${source.path} is missing a string "$key" field.');
    }
    return value;
  }
}
