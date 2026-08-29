import 'package:flutter/material.dart';

String initials(String value) => value.trim().toUpperCase();

List<String> active(List<String> values) =>
    values.where((value) => value != '').toList();

class Roster extends StatelessWidget {
  const Roster({super.key, required this.names});

  final List<String> names;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [for (final name in active(names)) Text(initials(name))],
    );
  }
}
