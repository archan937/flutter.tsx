import 'package:flutter/material.dart';

class TagList extends StatelessWidget {
  const TagList({super.key, required this.tags});

  final List<String> tags;

  @override
  Widget build(BuildContext context) {
    return Column(children: [for (final tag in tags) Text(tag)]);
  }
}
