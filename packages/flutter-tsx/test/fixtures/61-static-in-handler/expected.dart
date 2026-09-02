import 'package:flutter/material.dart';

class Measure extends StatefulWidget {
  const Measure({super.key});

  @override
  State<Measure> createState() => _MeasureState();
}

class _MeasureState extends State<Measure> {
  double _width = 0.0;
  String _label = 'unmeasured';

  void _measure() {
    final shortest = MediaQuery.of(context);
    setState(() {
      _width = MediaQuery.widthOf(context);
      _label = shortest.accessibleNavigation ? 'accessible' : 'standard';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('$_label at $_width'),
        ElevatedButton(onPressed: _measure, child: const Text('Measure')),
      ],
    );
  }
}
