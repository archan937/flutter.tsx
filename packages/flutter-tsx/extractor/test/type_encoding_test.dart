import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:test/test.dart';

import 'support/fixture_extraction.dart';

void main() {
  late WidgetEntity testWidget;

  setUpAll(() async {
    final entities = await extractFixtureEntities();
    testWidget = entities.whereType<WidgetEntity>().singleWhere(
      (entity) => entity.name == 'TestWidget',
    );
  });

  Map<String, Object?> typeOf(String paramName) => testWidget
      .constructors
      .first
      .params
      .singleWhere((param) => param.name == paramName)
      .type
      .toJson();

  group('type encoding', () {
    test('scalars', () {
      expect(typeOf('title'), {'kind': 'scalar', 'name': 'String'});
      expect(typeOf('count'), {'kind': 'scalar', 'name': 'int'});
    });

    test('nullable wraps the inner type', () {
      expect(typeOf('scale'), {
        'kind': 'nullable',
        'inner': {'kind': 'scalar', 'name': 'double'},
      });
    });

    test('widgets', () {
      expect(typeOf('child'), {
        'kind': 'nullable',
        'inner': {'kind': 'widget'},
      });
      expect(typeOf('children'), {
        'kind': 'list',
        'item': {'kind': 'widget'},
      });
    });

    test('enums', () {
      expect(typeOf('alignment'), {'kind': 'enum', 'name': 'TestAlignment'});
    });

    test('callbacks resolve through typedefs', () {
      expect(typeOf('onTap'), {
        'kind': 'nullable',
        'inner': {
          'kind': 'function',
          'returnType': {'kind': 'void'},
          'params': <Object?>[],
        },
      });
    });

    test('function types carry their parameters', () {
      expect(typeOf('onChanged'), {
        'kind': 'nullable',
        'inner': {
          'kind': 'function',
          'returnType': {'kind': 'void'},
          'params': [
            {
              'name': 'value',
              'type': {'kind': 'scalar', 'name': 'String'},
              'named': false,
              'required': true,
            },
          ],
        },
      });
    });

    test('collections', () {
      expect(typeOf('labels'), {
        'kind': 'map',
        'key': {'kind': 'scalar', 'name': 'String'},
        'value': {'kind': 'scalar', 'name': 'int'},
      });
      expect(typeOf('tags'), {
        'kind': 'set',
        'item': {'kind': 'scalar', 'name': 'String'},
      });
    });

    test('futures', () {
      expect(typeOf('loader'), {
        'kind': 'nullable',
        'inner': {
          'kind': 'future',
          'item': {'kind': 'scalar', 'name': 'int'},
        },
      });
    });

    test('dynamic maps to unknown', () {
      expect(typeOf('anything'), {'kind': 'unknown'});
    });

    test('other classes fall back to named types', () {
      expect(typeOf('extra'), {
        'kind': 'nullable',
        'inner': {'kind': 'named', 'name': 'NotAWidget'},
      });
    });

    test('every param records the display string', () {
      final count = testWidget.constructors.first.params.singleWhere(
        (param) => param.name == 'count',
      );
      expect(count.display, 'int');
      final onChanged = testWidget.constructors.first.params.singleWhere(
        (param) => param.name == 'onChanged',
      );
      expect(onChanged.display, 'void Function(String)?');
    });
  });
}
