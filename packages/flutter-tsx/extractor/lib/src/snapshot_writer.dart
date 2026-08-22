import 'dart:convert';
import 'dart:io';

import 'api_model.dart';

String encodeSnapshot(ApiSnapshot snapshot) {
  final sortedEntities = [...snapshot.entities]
    ..sort((first, second) => first.name.compareTo(second.name));

  final document = {
    'meta': snapshot.meta.toJson(),
    'entities': sortedEntities.map((entity) => entity.toJson()).toList(),
  };
  return '${const JsonEncoder.withIndent('  ').convert(document)}\n';
}

Future<void> writeSnapshot(ApiSnapshot snapshot, String outputPath) async {
  final outputFile = File(outputPath);
  await outputFile.parent.create(recursive: true);
  await outputFile.writeAsString(encodeSnapshot(snapshot));
}
