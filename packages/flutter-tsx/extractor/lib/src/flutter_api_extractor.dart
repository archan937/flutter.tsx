import 'package:path/path.dart' as path;

import 'api_model.dart';
import 'library_extractor.dart';
import 'sdk_layout.dart';

const defaultFlutterLibraries = [
  'foundation',
  'painting',
  'animation',
  'physics',
  'services',
  'widgets',
  'material',
  'cupertino',
];

Future<ApiSnapshot> extractFlutterApi({
  required SdkLayout layout,
  List<String> libraries = defaultFlutterLibraries,
  void Function(String library, int entityCount)? onLibraryExtracted,
}) async {
  final entities = <EntityModel>[];
  final seenNames = <String>{};

  for (final library in libraries) {
    final libraryUri = Uri.file(
      path.join(layout.flutterLibPath, '$library.dart'),
    ).toString();
    final extracted = await extractLibrary(
      libraryUri: libraryUri,
      includedPaths: [layout.flutterLibPath],
      sdkPath: layout.dartSdkPath,
      libraryLabel: library,
    );

    final fresh = extracted
        .where((entity) => seenNames.add(entity.name))
        .toList();
    entities.addAll(fresh);
    onLibraryExtracted?.call(library, fresh.length);
  }

  return ApiSnapshot(meta: layout.meta, entities: entities);
}
