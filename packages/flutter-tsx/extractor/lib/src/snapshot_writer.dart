import 'dart:convert';
import 'dart:io';

import 'api_model.dart';

String encodeSnapshot(ApiSnapshot snapshot) {
  final sortedEntities = [...snapshot.entities]
    ..sort((first, second) => first.name.compareTo(second.name));
  final sortedNames = snapshot.hierarchy.keys.toList()..sort();
  final sortedHierarchy = {
    for (final name in sortedNames) name: snapshot.hierarchy[name],
  };

  final sortedExportNames = snapshot.exports.keys.toList()..sort();
  final sortedExports = {
    for (final name in sortedExportNames) name: snapshot.exports[name],
  };

  final document = {
    'meta': snapshot.meta.toJson(),
    'hierarchy': sortedHierarchy,
    'exports': sortedExports,
    'entities': sortedEntities.map((entity) => entity.toJson()).toList(),
  };
  return '${const JsonEncoder.withIndent('  ').convert(document)}\n';
}

String encodePluginApi(PluginApi api) {
  final document = {
    'package': api.package,
    'version': api.version,
    'classes': api.classes.map((entity) => entity.toJson()).toList(),
    'enums': api.enums.map((entity) => entity.toJson()).toList(),
    'functions': api.functions.map((entity) => entity.toJson()).toList(),
    'instances': api.instances.map((entity) => entity.toJson()).toList(),
    'permissions': api.permissions.toJson(),
  };
  return '${const JsonEncoder.withIndent('  ').convert(document)}\n';
}

Future<void> writePluginApi(PluginApi api, String outputPath) async {
  final outputFile = File(outputPath);
  await outputFile.parent.create(recursive: true);
  await outputFile.writeAsString(encodePluginApi(api));
}

Future<void> writeSnapshot(ApiSnapshot snapshot, String outputPath) async {
  final outputFile = File(outputPath);
  await outputFile.parent.create(recursive: true);
  await outputFile.writeAsString(encodeSnapshot(snapshot));
}
