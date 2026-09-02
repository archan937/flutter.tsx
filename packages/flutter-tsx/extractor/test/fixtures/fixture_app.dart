// Stub Flutter hierarchy: lets extractor tests analyze without the real SDK.

abstract class Widget {
  const Widget();
}

abstract class StatelessWidget extends Widget {
  const StatelessWidget();
}

typedef VoidCallback = void Function();

/// How test things are aligned.
enum TestAlignment {
  /// Aligns to the start.
  start,

  /// Aligns to the center.
  center,

  /// Aligns to the end.
  end,
}

/// A plain value type that is not a widget.
class NotAWidget {
  const NotAWidget({this.label = 'x'});

  /// A well-known empty instance.
  static const NotAWidget none = NotAWidget();

  /// The label shown next to the thing.
  final String label;
}

/// Well-known palette values.
abstract final class TestPalette {
  /// The primary thing.
  static const NotAWidget primary = NotAWidget(label: 'primary');

  /// The default size.
  static const int size = 3;
}

/// Rejects empty item lists at construction time.
class GuardedList {
  const GuardedList({this.items = const ['x']})
    : assert(items.length > 0, 'items must not be empty');

  /// The guarded items.
  final List<String> items;
}

/// A singleton service acquired asynchronously.
class TestVault {
  TestVault._();

  /// Returns the shared vault.
  static Future<TestVault> getInstance() async => TestVault._();

  /// Stores a value.
  Future<bool> put(String key, String value) async => true;
}

/// A stateful helper whose constructor is deliberately not const.
/// Holds a value of some type.
class TestHolder<T> {
  const TestHolder(this.value);

  final T value;
}

/// Compares controllers, which is what it is built for.
class TestSorter implements Comparable<TestController> {
  const TestSorter();

  @override
  int compareTo(TestController other) => 0;
}

/// Takes a value of the type it is built for.
class TestBox<T> {
  const TestBox({required this.item});

  final T item;
}

class TestController {
  TestController({this.tick = 0});

  /// The current tick.
  final int tick;

  /// Releases what the controller holds.
  void dispose() {}
}

/// A value with nothing to release, so nothing to dispose.
class TestLink {
  TestLink();
}

abstract class AbstractWidget extends StatelessWidget {
  const AbstractWidget();
}

abstract class PreferredSizeLike implements Widget {
  const PreferredSizeLike();
}

mixin Tappable on Widget {}

class _PrivateWidget extends StatelessWidget {
  const _PrivateWidget();
}

/// A test widget exercising every parameter shape.
///
/// Second paragraph of documentation.
class TestWidget extends StatelessWidget {
  /// Creates a test widget.
  const TestWidget({
    required this.title,
    this.count = 3,
    this.scale,
    this.enabled = true,
    this.child,
    this.children = const <Widget>[],
    this.alignment = TestAlignment.center,
    this.onTap,
    this.onChanged,
    this.labels = const <String, int>{},
    this.tags = const <String>{},
    this.loader,
    this.ticks,
    this.extra,
    this.anything,
    this.holder,
    this.box,
    @Deprecated('Use title instead.') this.legacyTitle,
  }) : assert(count >= 0, 'count must not be negative');

  /// A compact variant.
  const TestWidget.compact({required this.title})
    : box = null,
      holder = null,
      count = 1,
      scale = null,
      enabled = true,
      child = null,
      children = const <Widget>[],
      alignment = TestAlignment.start,
      onTap = null,
      onChanged = null,
      labels = const <String, int>{},
      tags = const <String>{},
      loader = null,
      extra = null,
      legacyTitle = null;

  /// The title shown at the top.
  final String title;

  /// How many times to repeat.
  final int count;

  /// Optional scale factor.
  final double? scale;

  /// Whether interaction is enabled.
  final bool enabled;

  /// The single child.
  final Widget? child;

  /// The list of children.
  final List<Widget> children;

  /// How test content is aligned.
  final TestAlignment alignment;

  /// Called when the widget is tapped.
  final VoidCallback? onTap;

  /// Called with the new value on every change.
  final void Function(String value)? onChanged;

  /// Labels keyed by name.
  final Map<String, int> labels;

  /// Free-form tags.
  final Set<String> tags;

  /// Loads the count asynchronously.
  final Future<int>? loader;

  /// Emits every tick.
  final Stream<String>? ticks;

  /// An arbitrary companion value.
  final NotAWidget? extra;

  /// Escape hatch with no static type.
  final dynamic anything;

  /// A value whose type argument is part of what it is.
  final TestHolder<TestController>? holder;

  /// A value built for a type the class declares a parameter for.
  final TestBox<String>? box;

  /// The old title.
  final String? legacyTitle;
}

/// Wraps a child with optional padding.
class Wrapper extends StatelessWidget {
  const Wrapper(this.child, {this.padding});

  /// The wrapped child.
  final Widget child;

  /// Padding around the child.
  final double? padding;
}
