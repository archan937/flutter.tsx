import 'package:flutter/material.dart';

class TapTarget extends StatefulWidget {
  const TapTarget({super.key});

  @override
  State<TapTarget> createState() => _TapTargetState();
}

class _TapTargetState extends State<TapTarget> {
  int _taps = 0;

  void _bump() {
    setState(() {
      _taps++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        GestureDetector(
          onTap: _bump,
          onLongPress: _bump,
          child: Container(
            padding: const EdgeInsets.all(16),
            child: const Text('Tap me'),
          ),
        ),
        Text('Taps: $_taps'),
      ],
    );
  }
}
