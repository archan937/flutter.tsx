import 'package:flutter/material.dart';

class Pulse extends StatefulWidget {
  const Pulse({super.key});

  @override
  State<Pulse> createState() => _PulseState();
}

class _PulseState extends State<Pulse> with SingleTickerProviderStateMixin {
  late final AnimationController _fade = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 600),
  );

  @override
  void dispose() {
    _fade.dispose();
    super.dispose();
  }

  void _show() {
    _fade.forward();
  }

  void _hide() {
    _fade.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FadeTransition(opacity: _fade, child: const Text('Now you see me')),
        ElevatedButton(onPressed: _show, child: const Text('Show')),
        ElevatedButton(onPressed: _hide, child: const Text('Hide')),
      ],
    );
  }
}
