import 'package:flutter/material.dart';

class Totals extends StatelessWidget {
  const Totals({super.key, required this.names, required this.scores});

  final List<String> names;
  final List<num> scores;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('${scores.fold<num>(0, (sum, score) => sum + score)}'),
        Text(names.elementAtOrNull(0) ?? '-'),
        for (final name in names.where((name) => name != '')) Text(name),
      ],
    );
  }
}
