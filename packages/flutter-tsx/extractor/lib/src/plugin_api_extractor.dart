import 'dart:convert';
import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:path/path.dart' as path;

import 'api_model.dart';
import 'assert_inspector.dart';
import 'element_mapper.dart';
import 'plugin_manifests.dart';

/// Extracts a pub plugin's public API on demand, resolved through a project
/// that already depends on it (`flutter pub get` has run there) — the same
/// way fsx will do it inside a user's project.
Future<PluginApi> extractPluginApi({
  required String packageName,
  required String projectDir,
  String? sdkPath,
}) async {
  final version = _resolvedVersion(packageName, projectDir);

  final collection = AnalysisContextCollection(
    includedPaths: [path.normalize(projectDir)],
    sdkPath: sdkPath,
  );
  final session = collection.contexts.first.currentSession;
  final libraryUri = 'package:$packageName/$packageName.dart';
  final result = await session.getLibraryByUri(libraryUri);
  if (result is! LibraryElementResult) {
    throw StateError(
      'Could not load plugin library $libraryUri (${result.runtimeType}) — '
      'is "$packageName" a dependency of $projectDir?',
    );
  }

  final asserts = AssertInspector();
  final classes = <PluginClass>[];
  final enums = <EnumEntity>[];
  final functions = <FunctionModel>[];
  final seenNames = <String>{};

  for (final element in result.element.exportNamespace.definedNames2.values) {
    final elementName = element.name ?? '';
    if (elementName.isEmpty ||
        elementName.startsWith('_') ||
        !seenNames.add(elementName)) {
      continue;
    }
    switch (element) {
      case ClassElement():
        classes.add(mapPluginClass(element, asserts));
      case EnumElement():
        final mapped = mapEnum(element, packageName);
        if (mapped != null) {
          enums.add(mapped);
        }
      case TopLevelFunctionElement():
        functions.add(mapTopLevelFunction(element));
      default:
        break;
    }
  }

  if (classes.isEmpty && enums.isEmpty && functions.isEmpty) {
    throw StateError(
      'Extracted nothing from $libraryUri — the package has no '
      '$packageName.dart barrel or exports no public API.',
    );
  }
  classes.sort((first, second) => first.name.compareTo(second.name));
  enums.sort((first, second) => first.name.compareTo(second.name));
  functions.sort((first, second) => first.name.compareTo(second.name));
  return PluginApi(
    package: packageName,
    version: version,
    classes: classes,
    enums: enums,
    functions: functions,
    permissions: readPluginPermissions(
      packageName: packageName,
      projectDir: projectDir,
    ),
  );
}

String _resolvedVersion(String packageName, String projectDir) {
  final configFile = File(
    path.join(projectDir, '.dart_tool', 'package_config.json'),
  );
  final config = jsonDecode(configFile.readAsStringSync());
  if (config is! Map<String, Object?>) {
    throw StateError('Unreadable package_config.json in $projectDir');
  }
  final packages = config['packages'];
  if (packages is! List) {
    throw StateError('Unreadable package_config.json in $projectDir');
  }
  for (final entry in packages) {
    if (entry is Map<String, Object?> && entry['name'] == packageName) {
      final rootUri = entry['rootUri'];
      final directory = rootUri is String
          ? path.basename(Uri.parse(rootUri).path)
          : '';
      final separator = directory.indexOf('-');
      if (separator > 0) {
        return directory.substring(separator + 1);
      }
      throw StateError(
        'Could not determine the resolved version of "$packageName" from '
        '$directory — only pub-hosted plugins are supported.',
      );
    }
  }
  throw StateError(
    '"$packageName" is not in $projectDir/.dart_tool/package_config.json — '
    'add it to pubspec.yaml and run flutter pub get.',
  );
}
