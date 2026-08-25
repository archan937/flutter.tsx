import 'package:flutter/material.dart';

class Greeting extends StatelessWidget {
  const Greeting({super.key, required this.name});

  final String name;

  @override
  Widget build(BuildContext context) {
    return Text('Hello, $name!');
  }
}

class Welcome extends StatelessWidget {
  const Welcome({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        children: [
          Greeting(name: 'Paul'),
          Greeting(name: 'World'),
        ],
      ),
    );
  }
}
