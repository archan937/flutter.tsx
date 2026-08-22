import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;

Future<List<EntityModel>>? _cached;

Future<List<EntityModel>> extractFixtureEntities() {
  return _cached ??= extractFixtureEntitiesFresh();
}

Future<List<EntityModel>> extractFixtureEntitiesFresh() {
  final fixturesDir = path.normalize(
    path.join(Directory.current.path, 'test', 'fixtures'),
  );
  return extractLibrary(
    libraryUri: Uri.file(path.join(fixturesDir, 'fixture_app.dart')).toString(),
    includedPaths: [fixturesDir],
    libraryLabel: 'fixture',
  );
}
