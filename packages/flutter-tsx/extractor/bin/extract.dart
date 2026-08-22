import 'dart:io';

import 'package:args/args.dart';
import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';

Future<void> main(List<String> arguments) async {
  final parser = ArgParser()
    ..addOption(
      'flutter-path',
      mandatory: true,
      help: 'Flutter SDK root (e.g. ~/.fsx/flutter)',
    )
    ..addOption(
      'out',
      defaultsTo: '../ref/api.json',
      help: 'Output path for the API snapshot',
    );

  final ArgResults options;
  try {
    options = parser.parse(arguments);
  } on FormatException catch (error) {
    stderr
      ..writeln(error.message)
      ..writeln(parser.usage);
    exitCode = 64;
    return;
  }

  final SdkLayout layout;
  try {
    layout = SdkLayout.resolve(options['flutter-path'] as String);
  } on StateError catch (error) {
    stderr.writeln(error.message);
    exitCode = 1;
    return;
  }

  stdout.writeln(
    'Extracting Flutter ${layout.meta.frameworkVersion} API '
    'from ${layout.flutterLibPath}',
  );

  final snapshot = await extractFlutterApi(
    layout: layout,
    onLibraryExtracted: (library, entityCount) =>
        stdout.writeln('  $library: $entityCount entities'),
  );

  final outputPath = options['out'] as String;
  await writeSnapshot(snapshot, outputPath);
  stdout.writeln(
    'Wrote ${snapshot.entities.length} entities to $outputPath '
    '(Flutter ${layout.meta.frameworkVersion}, deterministic).',
  );
}
