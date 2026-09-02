import 'package:flutter/material.dart';

class Header extends StatelessWidget {
  const Header({super.key});

  @override
  Widget build(BuildContext context) {
    final title = const Text('Flutter.tsx');
    final width = MediaQuery.widthOf(context);
    return Column(children: [title, Text('Width: $width')]);
  }
}
