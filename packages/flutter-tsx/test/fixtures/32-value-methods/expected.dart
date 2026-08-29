import 'package:flutter/material.dart';

class ValueMethods extends StatelessWidget {
  const ValueMethods({
    super.key,
    required this.name,
    required this.tags,
    required this.score,
  });

  final String name;
  final List<String> tags;
  final double score;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(name.trim().toUpperCase()),
        Text(tags.join(', ')),
        Text(score.toStringAsFixed(1)),
        Text(name.contains('a') ? 'match' : 'no match'),
      ],
    );
  }
}
