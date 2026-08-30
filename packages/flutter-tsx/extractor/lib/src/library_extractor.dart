import 'dart:io';

import 'package:analyzer/dart/analysis/analysis_context_collection.dart';
import 'package:analyzer/dart/analysis/results.dart';
import 'package:analyzer/dart/element/element.dart';
import 'package:path/path.dart' as path;

import 'api_model.dart';
import 'assert_inspector.dart';
import 'element_mapper.dart';

class LibraryExtraction {
  const LibraryExtraction({required this.entities, required this.hierarchy});

  final List<EntityModel> entities;
  final Map<String, List<String>> hierarchy;
}

Future<LibraryExtraction> extractLibrary({
  required String libraryUri,
  required List<String> includedPaths,
  required String libraryLabel,
  String? sdkPath,
}) async {
  final parsedUri = Uri.parse(libraryUri);
  if (parsedUri.isScheme('file') && !File.fromUri(parsedUri).existsSync()) {
    throw StateError(
      'Library file not found: ${parsedUri.toFilePath()} — a missing library '
      'must fail loudly, never extract as empty.',
    );
  }

  final collection = AnalysisContextCollection(
    includedPaths: includedPaths.map(path.normalize).toList(),
    sdkPath: sdkPath,
  );
  final session = collection.contexts.first.currentSession;
  final result = await session.getLibraryByUri(libraryUri);
  if (result is! LibraryElementResult) {
    throw StateError(
      'Could not load library $libraryUri (${result.runtimeType}) — '
      'analyzed with sdkPath=$sdkPath, includedPaths=$includedPaths, '
      'context root ${collection.contexts.first.contextRoot.root.path}, '
      'package config '
      '${collection.contexts.first.contextRoot.packagesFile?.path}',
    );
  }

  final entities = <EntityModel>[];
  final hierarchy = <String, List<String>>{};
  final seenNames = <String>{};
  final asserts = AssertInspector();

  for (final element in result.element.exportNamespace.definedNames2.values) {
    final elementName = element.name ?? '';
    if (elementName.isEmpty || !seenNames.add(elementName)) {
      continue;
    }

    if (element is ClassElement || element is MixinElement) {
      hierarchy[elementName] = publicSupertypeNames(
        element as InterfaceElement,
      );
    }

    final entity = switch (element) {
      ClassElement() => mapClass(element, libraryLabel, asserts),
      EnumElement() => mapEnum(element, libraryLabel),
      _ => null,
    };
    if (entity != null) {
      entities.add(entity);
    }
  }

  entities.sort((first, second) => first.name.compareTo(second.name));
  return LibraryExtraction(entities: entities, hierarchy: hierarchy);
}
