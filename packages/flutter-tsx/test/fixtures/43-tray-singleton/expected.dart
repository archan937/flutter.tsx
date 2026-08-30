import 'package:flutter/material.dart';
import 'package:tray_manager/tray_manager.dart';

class TrayTooltip extends StatefulWidget {
  const TrayTooltip({super.key});

  @override
  State<TrayTooltip> createState() => _TrayTooltipState();
}

class _TrayTooltipState extends State<TrayTooltip> {
  bool _shown = false;

  Future<void> _show() async {
    await trayManager.setToolTip('Flutter.tsx');
    setState(() {
      _shown = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_shown) const Text('Tray ready'),
        ElevatedButton(onPressed: _show, child: const Text('Set tooltip')),
      ],
    );
  }
}
