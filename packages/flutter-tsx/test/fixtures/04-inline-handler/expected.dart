import 'package:flutter/material.dart';

class Toggles extends StatelessWidget {
  const Toggles({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Notifications'),
        Switch(value: true, onChanged: (_) {}),
        Switch(value: false, onChanged: (_) {}),
      ],
    );
  }
}
