import 'package:flutter/material.dart';

class Adaptive extends StatelessWidget {
  const Adaptive({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        LayoutBuilder(
          builder: (context, constraints) => constraints.maxWidth > 600
              ? const Text('Wide')
              : const Text('Narrow'),
        ),
      ],
    );
  }
}
