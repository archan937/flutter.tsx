import 'dart:math' as math;

import 'package:flutter/material.dart';

String duration(num seconds) {
  final minutes = (seconds / 60).floor();
  final rest = (seconds % 60).round();
  if (rest < 10) {
    return '$minutes:0$rest';
  }
  return '$minutes:$rest';
}

String loudness(num peak) => '${(math.min(peak, 1) * 100).round()}%';

class Meter extends StatelessWidget {
  const Meter({super.key, required this.seconds, required this.peak});

  final num seconds;
  final num peak;

  @override
  Widget build(BuildContext context) {
    return Column(children: [Text(duration(seconds)), Text(loudness(peak))]);
  }
}
