import 'package:flutter/material.dart';

class Fader extends StatefulWidget {
  const Fader({super.key});

  @override
  State<Fader> createState() => _FaderState();
}

class _FaderState extends State<Fader> {
  bool _shown = true;

  void _toggle() {
    setState(() {
      _shown = !_shown;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AnimatedOpacity(
          opacity: _shown ? 1 : 0,
          duration: const Duration(milliseconds: 300),
          child: const Text('Fades'),
        ),
        ElevatedButton(onPressed: _toggle, child: const Text('Toggle')),
      ],
    );
  }
}
