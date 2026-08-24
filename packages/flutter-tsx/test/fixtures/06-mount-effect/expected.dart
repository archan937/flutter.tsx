import 'package:flutter/material.dart';

class Status extends StatefulWidget {
  const Status({super.key});

  @override
  State<Status> createState() => _StatusState();
}

class _StatusState extends State<Status> {
  bool _online = false;
  int _checks = 0;

  @override
  void initState() {
    super.initState();
    _online = true;
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        _online ? const Text('Online') : const Text('Offline'),
        Text('Checks: $_checks'),
        ElevatedButton(
          onPressed: () => setState(() => _checks++),
          child: const Text('Check'),
        ),
      ],
    );
  }
}
