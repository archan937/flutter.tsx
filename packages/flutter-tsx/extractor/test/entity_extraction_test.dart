import 'package:flutter_tsx_extractor/flutter_tsx_extractor.dart';
import 'package:test/test.dart';

import 'support/fixture_extraction.dart';

void main() {
  late List<EntityModel> entities;
  late WidgetEntity testWidget;
  late WidgetEntity wrapper;
  late EnumEntity alignment;

  late Map<String, List<String>> hierarchy;

  setUpAll(() async {
    final extraction = await extractFixtureEntities();
    hierarchy = extraction.hierarchy;
    entities = extraction.entities;
    testWidget = entities.whereType<WidgetEntity>().singleWhere(
      (entity) => entity.name == 'TestWidget',
    );
    wrapper = entities.whereType<WidgetEntity>().singleWhere(
      (entity) => entity.name == 'Wrapper',
    );
    alignment = entities.whereType<EnumEntity>().singleWhere(
      (entity) => entity.name == 'TestAlignment',
    );
  });

  group('entity selection', () {
    test('extracts exactly the public entities, classified', () {
      expect(entities.map((entity) => '${entity.kind} ${entity.name}'), [
        'class GuardedList',
        'class NotAWidget',
        'enum TestAlignment',
        'class TestController',
        'class TestPalette',
        'class TestVault',
        'widget TestWidget',
        'widget Wrapper',
      ]);
    });

    test('labels entities with their library', () {
      expect(testWidget.library, 'fixture');
    });
  });

  group('widget documentation and hierarchy', () {
    test('captures the complete class dartdoc', () {
      expect(
        testWidget.doc,
        '/// A test widget exercising every parameter shape.\n'
        '///\n'
        '/// Second paragraph of documentation.',
      );
    });

    test('records public supertype names in hierarchy order', () {
      expect(testWidget.supertypes, ['StatelessWidget', 'Widget']);
    });
  });

  group('constructors', () {
    test('extracts the default and named constructors', () {
      expect(testWidget.constructors.map((constructor) => constructor.name), [
        '',
        'compact',
      ]);
    });

    test('captures constructor documentation', () {
      expect(testWidget.constructors.last.doc, '/// A compact variant.');
    });

    test('flags asserts that access parameter members', () {
      final guarded = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'GuardedList',
      );
      expect(guarded.constructors.single.paramMemberAsserts, true);
      expect(
        testWidget.constructors.map(
          (constructor) => constructor.paramMemberAsserts,
        ),
        [false, false],
      );
    });

    test('records const-ness per constructor', () {
      expect(
        testWidget.constructors.map((constructor) => constructor.isConst),
        [true, true],
      );
      final controller = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestController',
      );
      expect(
        controller.constructors.map((constructor) => constructor.isConst),
        [false],
      );
    });

    test('keeps parameters in declaration order', () {
      final defaultConstructor = testWidget.constructors.first;
      expect(defaultConstructor.params.map((param) => param.name).take(4), [
        'title',
        'count',
        'scale',
        'enabled',
      ]);
    });
  });

  group('parameters', () {
    ParamModel paramNamed(String name) => testWidget.constructors.first.params
        .singleWhere((param) => param.name == name);

    test('marks required named parameters', () {
      final title = paramNamed('title');
      expect(title.isNamed, isTrue);
      expect(title.isRequired, isTrue);
      expect(title.defaultValue, isNull);
    });

    test('captures default values as source code', () {
      expect(paramNamed('count').defaultValue, '3');
      expect(paramNamed('enabled').defaultValue, 'true');
      expect(paramNamed('children').defaultValue, 'const <Widget>[]');
      expect(paramNamed('alignment').defaultValue, 'TestAlignment.center');
    });

    test('pulls parameter documentation from the backing field', () {
      expect(paramNamed('title').doc, '/// The title shown at the top.');
      expect(paramNamed('onTap').doc, '/// Called when the widget is tapped.');
    });

    test('marks deprecated parameters', () {
      expect(paramNamed('legacyTitle').isDeprecated, isTrue);
      expect(paramNamed('title').isDeprecated, isFalse);
    });

    test('handles positional parameters', () {
      final child = wrapper.constructors.first.params.first;
      expect(child.name, 'child');
      expect(child.isNamed, isFalse);
      expect(child.isRequired, isTrue);
      expect(child.doc, '/// The wrapped child.');
    });
  });

  group('static constants', () {
    ClassEntity classNamed(String name) => entities
        .whereType<ClassEntity>()
        .singleWhere((entity) => entity.name == name);

    test('captures a constants-only abstract class in full', () {
      final palette = classNamed('TestPalette');
      expect(palette.doc, '/// Well-known palette values.');
      expect(palette.constructors, isEmpty);
      expect(palette.constants.map((constant) => constant.toJson()), [
        {
          'name': 'primary',
          'type': {'kind': 'named', 'name': 'NotAWidget'},
          'display': 'NotAWidget',
          'doc': '/// The primary thing.',
        },
        {
          'name': 'size',
          'type': {'kind': 'scalar', 'name': 'int'},
          'display': 'int',
          'doc': '/// The default size.',
        },
      ]);
    });

    test('captures constants on constructible classes too', () {
      expect(
        classNamed('NotAWidget').constants.map((constant) => constant.toJson()),
        [
          {
            'name': 'none',
            'type': {'kind': 'named', 'name': 'NotAWidget'},
            'display': 'NotAWidget',
            'doc': '/// A well-known empty instance.',
          },
        ],
      );
    });

    test('widgets without static constants carry an empty list', () {
      expect(testWidget.constants, isEmpty);
    });
  });

  group('hierarchy', () {
    test('maps every public class, including abstract ones, to its public '
        'supertypes', () {
      expect(hierarchy, {
        'AbstractWidget': ['StatelessWidget', 'Widget'],
        'GuardedList': <String>[],
        'NotAWidget': <String>[],
        'PreferredSizeLike': ['Widget'],
        'StatelessWidget': ['Widget'],
        'Tappable': ['Widget'],
        'TestController': <String>[],
        'TestPalette': <String>[],
        'TestVault': <String>[],
        'TestWidget': ['StatelessWidget', 'Widget'],
        'Widget': <String>[],
        'Wrapper': ['StatelessWidget', 'Widget'],
      });
    });
  });

  group('enums', () {
    test('extracts values in declaration order', () {
      expect(alignment.values.map((value) => value.name), [
        'start',
        'center',
        'end',
      ]);
    });

    test('captures enum and value documentation', () {
      expect(alignment.doc, '/// How test things are aligned.');
      expect(alignment.values.first.doc, '/// Aligns to the start.');
    });
  });
}
