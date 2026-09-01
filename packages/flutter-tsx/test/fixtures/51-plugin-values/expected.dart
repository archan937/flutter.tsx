import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class OpenInApp extends StatefulWidget {
  const OpenInApp({super.key});

  @override
  State<OpenInApp> createState() => _OpenInAppState();
}

class _OpenInAppState extends State<OpenInApp> {
  String _opened = 'nothing yet';

  Future<void> _open() async {
    await launchUrl(
      Uri.parse('https://flutter.dev'),
      mode: LaunchMode.inAppWebView,
      webViewConfiguration: const WebViewConfiguration(
        enableJavaScript: true,
        enableDomStorage: false,
      ),
    );
    setState(() {
      _opened = 'flutter.dev';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_opened),
        ElevatedButton(onPressed: _open, child: const Text('Open in app')),
      ],
    );
  }
}
