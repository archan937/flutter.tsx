import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;

Future<LibraryExtraction>? _cached;

Future<LibraryExtraction> extractFixtureEntities() {
  return _cached ??= extractFixtureEntitiesFresh();
}

Future<LibraryExtraction> extractFixtureEntitiesFresh() {
  final fixturesDir = path.normalize(
    path.join(Directory.current.path, 'test', 'fixtures'),
  );
  return extractLibrary(
    libraryUri: Uri.file(path.join(fixturesDir, 'fixture_app.dart')).toString(),
    includedPaths: [fixturesDir],
    libraryLabel: 'fixture',
  );
}
