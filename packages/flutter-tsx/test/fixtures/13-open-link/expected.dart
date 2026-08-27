import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OpenLink extends StatefulWidget {
  const OpenLink({super.key});

  @override
  State<OpenLink> createState() => _OpenLinkState();
}

class _OpenLinkState extends State<OpenLink> {
  bool _opened = false;

  Future<void> _open() async {
    await launchUrl(
      Uri.parse('https://flutter.dev'),
      mode: LaunchMode.externalApplication,
    );
    setState(() {
      _opened = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_opened) const Text('Opened!'),
        ElevatedButton(onPressed: _open, child: const Text('Open')),
      ],
    );
  }
}
