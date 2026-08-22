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

abstract class AbstractWidget extends StatelessWidget {
  const AbstractWidget();
}

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
    this.extra,
    this.anything,
    @Deprecated('Use title instead.') this.legacyTitle,
  });

  /// A compact variant.
  const TestWidget.compact({required this.title})
    : count = 1,
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

  /// An arbitrary companion value.
  final NotAWidget? extra;

  /// Escape hatch with no static type.
  final dynamic anything;

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
