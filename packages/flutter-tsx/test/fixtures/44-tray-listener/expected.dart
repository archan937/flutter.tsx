import 'package:flutter/material.dart';
import 'package:tray_manager/tray_manager.dart';

class TrayMenu extends StatefulWidget {
  const TrayMenu({super.key});

  @override
  State<TrayMenu> createState() => _TrayMenuState();
}

class _TrayMenuState extends State<TrayMenu> with TrayListener {
  String _label = 'none';

  @override
  void initState() {
    super.initState();
    trayManager.addListener(this);
  }

  @override
  void dispose() {
    trayManager.removeListener(this);
    super.dispose();
  }

  @override
  void onTrayIconMouseDown() {
    setState(() {
      _label = 'icon';
    });
  }

  @override
  void onTrayMenuItemClick(MenuItem item) {
    setState(() {
      _label = item.key ?? 'none';
    });
  }

  Future<void> _setup() async {
    await trayManager.setToolTip('Flutter.tsx');
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_label),
        ElevatedButton(onPressed: _setup, child: const Text('Set tooltip')),
      ],
    );
  }
}
