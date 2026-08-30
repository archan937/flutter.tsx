import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class Browser extends StatefulWidget {
  const Browser({super.key});

  @override
  State<Browser> createState() => _BrowserState();
}

class _BrowserState extends State<Browser> {
  bool _open = false;

  @override
  void initState() {
    super.initState();
    _open = true;
  }

  @override
  void dispose() {
    closeInAppWebView();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(children: [Text(_open ? 'Open' : 'Closed')]);
  }
}
