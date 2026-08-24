import 'package:flutter/material.dart';

class HelloScreen extends StatelessWidget {
  const HelloScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Text('Hello Flutter.tsx'),
        Center(child: Text('It works!')),
      ],
    );
  }
}
