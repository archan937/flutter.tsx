import 'package:flutter/material.dart';

class Stepper extends StatefulWidget {
  const Stepper({super.key});

  @override
  State<Stepper> createState() => _StepperState();
}

class _StepperState extends State<Stepper> {
  int _count = 0;

  void _bump() {
    if (_count >= 3) {
      setState(() {
        _count = 0;
      });
    } else if (_count == 2) {
      setState(() {
        _count += 2;
      });
    } else {
      setState(() {
        _count++;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Count: $_count'),
        ElevatedButton(onPressed: _bump, child: const Text('Bump')),
      ],
    );
  }
}
