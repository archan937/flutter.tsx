import 'dart:io';

import 'package:args/args.dart';
import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';

Future<void> main(List<String> arguments) async {
  final parser = ArgParser()
    ..addOption('package', mandatory: true)
    ..addOption('project', mandatory: true)
    ..addOption('sdk-path')
    ..addOption('out', mandatory: true);
  final options = parser.parse(arguments);

  final api = await extractPluginApi(
    packageName: options['package'] as String,
    projectDir: options['project'] as String,
    sdkPath: options['sdk-path'] as String?,
  );
  await writePluginApi(api, options['out'] as String);
  stdout.writeln(
    'Wrote ${api.classes.length} classes, ${api.enums.length} enums, '
    '${api.functions.length} functions for ${api.package} ${api.version}.',
  );
}
