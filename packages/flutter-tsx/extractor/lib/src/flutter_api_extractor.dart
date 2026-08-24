import 'package:path/path.dart' as path;

import 'api_model.dart';
import 'library_extractor.dart';
import 'sdk_layout.dart';

const defaultFlutterLibraries = [
  'dart:ui',
  'foundation',
  'physics',
  'painting',
  'animation',
  'scheduler',
  'gestures',
  'semantics',
  'services',
  'rendering',
  'widgets',
  'material',
  'cupertino',
  'widget_previews',
];

Future<ApiSnapshot> extractFlutterApi({
  required SdkLayout layout,
  List<String> libraries = defaultFlutterLibraries,
  void Function(String library, int entityCount)? onLibraryExtracted,
}) async {
  final entitiesByName = <String, EntityModel>{};
  final hierarchy = <String, List<String>>{};
  final exportedBy = <String, List<String>>{};

  for (final library in libraries) {
    final isDartCoreLibrary = library.startsWith('dart:');
    final libraryUri = isDartCoreLibrary
        ? library
        : Uri.file(path.join(layout.flutterLibPath, '$library.dart'))
              .toString();
    final extracted = await extractLibrary(
      libraryUri: libraryUri,
      includedPaths: [layout.flutterLibPath],
      sdkPath: layout.dartSdkPath,
      libraryLabel: isDartCoreLibrary ? library.substring(5) : library,
    );

    final label = isDartCoreLibrary ? library.substring(5) : library;
    var freshCount = 0;
    for (final entity in extracted.entities) {
      (exportedBy[entity.name] ??= []).add(label);
      final existing = entitiesByName[entity.name];
      // A bare name can be claimed by two Dart types (dart:ui Image vs the
      // Image widget, dart:ui TextStyle vs painting's). The JSX-facing widget
      // must win, a framework type beats the dart:ui type it shadows (the
      // framework barrels never re-export the shadowed engine type), and it
      // is first-wins otherwise.
      final widgetWinsCollision =
          existing != null &&
          existing is! WidgetEntity &&
          entity is WidgetEntity;
      final frameworkWinsOverUi =
          existing != null &&
          existing is! WidgetEntity &&
          existing.library == 'ui' &&
          entity.library != 'ui';
      if (existing == null || widgetWinsCollision || frameworkWinsOverUi) {
        if (existing == null) {
          freshCount += 1;
        }
        entitiesByName[entity.name] = entity;
        hierarchy[entity.name] =
            extracted.hierarchy[entity.name] ?? hierarchy[entity.name] ?? [];
      }
    }
    for (final entry in extracted.hierarchy.entries) {
      hierarchy.putIfAbsent(entry.key, () => entry.value);
    }
    onLibraryExtracted?.call(library, freshCount);
  }

  final entities = entitiesByName.values.toList()
    ..sort((first, second) => first.name.compareTo(second.name));
  final exports = {
    for (final entity in entities) entity.name: exportedBy[entity.name]!,
  };
  return ApiSnapshot(
    meta: layout.meta,
    hierarchy: hierarchy,
    exports: exports,
    entities: entities,
  );
}
