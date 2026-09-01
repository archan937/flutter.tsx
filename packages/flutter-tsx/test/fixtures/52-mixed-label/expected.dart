import 'package:flutter/material.dart';

class PlayCount extends StatefulWidget {
  const PlayCount({super.key});

  @override
  State<PlayCount> createState() => _PlayCountState();
}

class _PlayCountState extends State<PlayCount> {
  int _plays = 0;

  void _play() {
    setState(() {
      _plays++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Now playing'),
        ElevatedButton(onPressed: _play, child: Text('Played $_plays times')),
      ],
    );
  }
}
