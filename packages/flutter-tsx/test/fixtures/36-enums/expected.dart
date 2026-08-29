import 'package:flutter/material.dart';

abstract final class BadgeStatus {
  static const String active = 'active';
  static const String paused = 'paused';
}

class Badge extends StatelessWidget {
  const Badge({super.key, required this.status, required this.tone});

  final String status;
  final String tone;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(status == BadgeStatus.active ? 'running' : 'stopped'),
        Text(tone),
      ],
    );
  }
}
