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
        // An abstract class is a type the surface needs — `Action`, a sliver
        // delegate — but never a component: nothing can build one.
        'class AbstractWidget',
        'class GuardedList',
        'class NotAWidget',
        'class PreferredSizeLike',
        'class StatelessWidget',
        'enum TestAlignment',
        'class TestBox',
        'class TestController',
        'class TestHolder',
        'class TestLink',
        'class TestPalette',
        'class TestScope',
        'class TestSorter',
        'class TestVault',
        'widget TestWidget',
        'class Widget',
        'widget Wrapper',
      ]);
    });

    test(
      'a class says what it is built for, and its parameters say so too',
      () {
        // `TestBox<String>` can bind T to String only because the class names
        // its parameter and the constructor says `T`.
        final box = entities.whereType<ClassEntity>().singleWhere(
          (entity) => entity.name == 'TestBox',
        );

        expect(box.typeParams, ['T']);
        expect(box.constructors.first.params.first.type.toJson(), {
          'kind': 'typeVar',
          'name': 'T',
        });
      },
    );

    test('records the statics a class offers, methods and getters alike', () {
      // `MediaQuery.of(context)` is how half of Flutter is read; a value
      // with no constructor is still reachable through one of these.
      final scope = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestScope',
      );

      expect(scope.statics.map((method) => method.name), ['of']);
      expect(scope.statics.single.params.map((param) => param.name), [
        'context',
      ]);
      expect(scope.statics.single.returnType.toJson(), {
        'kind': 'named',
        'name': 'TestScope',
      });
      expect(scope.staticGetters.map((getter) => getter.name), ['fallback']);
    });

    test('records that an abstract class cannot be built', () {
      // Nothing constructs an abstract class; only a concrete subclass of it
      // can be written, and the compiler has to know which is which.
      final abstractWidget = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'AbstractWidget',
      );
      final concrete = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestController',
      );

      expect(abstractWidget.isAbstract, isTrue);
      expect(abstractWidget.toJson()['abstract'], isTrue);
      expect(concrete.isAbstract, isFalse);
      expect(concrete.toJson().containsKey('abstract'), isFalse);
    });

    test('records the methods a value answers to', () {
      // Owning a controller is pointless without calling it: `jumpTo`,
      // `requestFocus`, `animateTo` are the whole reason to hold one.
      final controller = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestController',
      );
      final jumpTo = controller.methods.singleWhere(
        (method) => method.name == 'jumpTo',
      );

      // A private method is not part of the surface, and `dispose` is the
      // lifecycle the compiler already writes.
      expect(controller.methods.map((method) => method.name), ['jumpTo']);
      expect(jumpTo.params.map((param) => param.name), ['offset', 'animated']);
      expect(jumpTo.returnType.toJson(), {'kind': 'void'});
    });

    test('records whether a value has to be disposed', () {
      // A component owning one of these has to release it; the compiler
      // cannot know which from the name, so the extractor says so.
      final controller = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestController',
      );
      final link = entities.whereType<ClassEntity>().singleWhere(
        (entity) => entity.name == 'TestLink',
      );

      expect(controller.disposable, isTrue);
      expect(link.disposable, isFalse);
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
        'TestBox': <String>[],
        'TestController': <String>[],
        'TestHolder': <String>[],
        'TestLink': <String>[],
        'TestPalette': <String>[],
        'TestScope': <String>[],
        'TestSorter': ['Comparable'],
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
