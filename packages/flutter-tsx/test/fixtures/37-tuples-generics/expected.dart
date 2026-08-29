import 'package:flutter/material.dart';

T firstOr<T>(List<T> values, T fallback) =>
    values.elementAtOrNull(0) ?? fallback;

class Span extends StatelessWidget {
  const Span({super.key, required this.range, required this.names});

  final (String, double) range;
  final List<String> names;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(range.$1),
        Text('${range.$2}'),
        Text(firstOr(names, 'none')),
      ],
    );
  }
}
