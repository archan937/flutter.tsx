import 'package:flutter/material.dart';

class Panel extends StatefulWidget {
  const Panel({super.key});

  @override
  State<Panel> createState() => _PanelState();
}

class _PanelState extends State<Panel> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Builder(
          builder: (_) => _open ? const Text('Open') : const Text('Closed'),
        ),
        ElevatedButton(
          onPressed: () => setState(() => _open = !_open),
          child: const Text('Toggle'),
        ),
      ],
    );
  }
}
