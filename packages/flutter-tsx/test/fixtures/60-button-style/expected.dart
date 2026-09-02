import 'package:flutter/material.dart';

class Styled extends StatelessWidget {
  const Styled({super.key});

  @override
  Widget build(BuildContext context) {
    final style = ElevatedButton.styleFrom(
      backgroundColor: Colors.indigo,
      foregroundColor: Colors.white,
    );
    return Column(
      children: [
        ElevatedButton(
          style: style,
          onPressed: () {},
          child: const Text('Save'),
        ),
      ],
    );
  }
}
