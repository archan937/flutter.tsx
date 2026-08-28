import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

class InlineLink extends StatelessWidget {
  const InlineLink({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: GestureDetector(
        onTap: () => launchUrl(Uri.parse('https://flutter.dev')),
        child: const Text('Open'),
      ),
    );
  }
}
