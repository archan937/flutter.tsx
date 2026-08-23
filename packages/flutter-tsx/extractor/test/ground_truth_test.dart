@Tags(['sdk'])
library;

import 'dart:io';

import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:path/path.dart' as path;
import 'package:test/test.dart';

void main() {
  late Map<String, EntityModel> byName;
  late Map<String, List<String>> hierarchy;

  setUpAll(() async {
    final home = Platform.environment['HOME'];
    final flutterRoot =
        Platform.environment['FSX_FLUTTER_ROOT'] ??
        path.join(home ?? '', '.fsx', 'flutter');
    final layout = SdkLayout.resolve(flutterRoot);

    final reportedLibraries = <String>[];
    var reportedEntityCount = 0;
    final snapshot = await extractFlutterApi(
      layout: layout,
      libraries: const ['widgets', 'material'],
      onLibraryExtracted: (library, entityCount) {
        reportedLibraries.add(library);
        reportedEntityCount += entityCount;
      },
    );
    byName = {for (final entity in snapshot.entities) entity.name: entity};
    hierarchy = snapshot.hierarchy;

    expect(reportedLibraries, ['widgets', 'material']);
    expect(reportedEntityCount, snapshot.entities.length);
  });

  WidgetEntity widgetNamed(String name) => byName[name] as WidgetEntity;

  ParamModel paramOf(String widgetName, String paramName) =>
      widgetNamed(widgetName).constructors.first.params
          .singleWhere((param) => param.name == paramName);

  group('ground truths from the installed SDK', () {
    test('Column takes children as a widget list', () {
      expect(paramOf('Column', 'children').type.toJson(), {
        'kind': 'list',
        'item': {'kind': 'widget'},
      });
    });

    test('Center takes an optional child widget', () {
      expect(paramOf('Center', 'child').type.toJson(), {
        'kind': 'nullable',
        'inner': {'kind': 'widget'},
      });
    });

    test('Scaffold exposes appBar and body slots', () {
      final appBar = paramOf('Scaffold', 'appBar');
      final body = paramOf('Scaffold', 'body');
      expect(appBar.type.toJson(), {
        'kind': 'nullable',
        'inner': {'kind': 'named', 'name': 'PreferredSizeWidget'},
      });
      expect(body.type.toJson(), {
        'kind': 'nullable',
        'inner': {'kind': 'widget'},
      });
    });

    test('ElevatedButton.onPressed is a nullable void callback', () {
      expect(paramOf('ElevatedButton', 'onPressed').type.toJson(), {
        'kind': 'nullable',
        'inner': {
          'kind': 'function',
          'returnType': {'kind': 'void'},
          'params': <Object?>[],
        },
      });
    });

    test('Text takes a positional required string', () {
      final data = paramOf('Text', 'data');
      expect(data.isNamed, isFalse);
      expect(data.isRequired, isTrue);
      expect(data.type.toJson(), {'kind': 'scalar', 'name': 'String'});
    });

    test('Axis enum has horizontal and vertical', () {
      final axis = byName['Axis'] as EnumEntity;
      expect(axis.values.map((value) => value.name), [
        'horizontal',
        'vertical',
      ]);
    });

    test('ListView ships exactly its public constructors', () {
      expect(widgetNamed('ListView').constructors.map((item) => item.name), [
        '',
        'builder',
        'custom',
        'separated',
      ]);
    });

    test('AppBar carries its full public supertype chain', () {
      expect(widgetNamed('AppBar').supertypes, [
        'StatefulWidget',
        'Widget',
        'DiagnosticableTree',
        'Diagnosticable',
        'PreferredSizeWidget',
      ]);
    });

    test('hierarchy covers abstract widget interfaces and non-widgets', () {
      expect(hierarchy['PreferredSizeWidget'], [
        'Widget',
        'DiagnosticableTree',
        'Diagnosticable',
      ]);
      expect(hierarchy['StatelessWidget'], [
        'Widget',
        'DiagnosticableTree',
        'Diagnosticable',
      ]);
    });

    test('Colors is a static-constants class with typed swatches', () {
      final colors = byName['Colors'] as ClassEntity;
      final red = colors.constants.singleWhere(
        (constant) => constant.name == 'red',
      );
      expect(colors.constructors, isEmpty);
      expect(red.type.toJson(), {'kind': 'named', 'name': 'MaterialColor'});
      expect(
        red.doc.split('\n').first,
        '/// The red primary color and swatch.',
      );
    });

    test('Icons.add is captured in full', () {
      final icons = byName['Icons'] as ClassEntity;
      final add = icons.constants.singleWhere(
        (constant) => constant.name == 'add',
      );
      expect(add.toJson(), {
        'name': 'add',
        'type': {'kind': 'named', 'name': 'IconData'},
        'display': 'IconData',
        'doc':
            '/// <i class="material-icons md-36">add</i> &#x2014; material '
            'icon named "add".',
      });
    });

    test('Curves.easeIn is a typed Cubic constant', () {
      final curves = byName['Curves'] as ClassEntity;
      final easeIn = curves.constants.singleWhere(
        (constant) => constant.name == 'easeIn',
      );
      expect(easeIn.type.toJson(), {'kind': 'named', 'name': 'Cubic'});
    });

    test('widget dartdoc is captured', () {
      expect(
        widgetNamed('Scaffold').doc.split('\n').first,
        '/// Implements the basic Material Design visual layout structure.',
      );
    });
  });
}
