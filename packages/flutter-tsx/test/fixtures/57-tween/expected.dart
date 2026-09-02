import 'package:flutter/material.dart';

class Drifter extends StatefulWidget {
  const Drifter({super.key});

  @override
  State<Drifter> createState() => _DrifterState();
}

class _DrifterState extends State<Drifter> with SingleTickerProviderStateMixin {
  late final AnimationController _drift = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 400),
  );

  @override
  void dispose() {
    _drift.dispose();
    super.dispose();
  }

  void _run() {
    _drift.forward();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        AlignTransition(
          alignment: _drift.drive(
            Tween<AlignmentGeometry>(
              begin: AlignmentGeometry.topLeft,
              end: AlignmentGeometry.bottomRight,
            ),
          ),
          child: const Text('Drifts across'),
        ),
        ElevatedButton(onPressed: _run, child: const Text('Run')),
      ],
    );
  }
}
