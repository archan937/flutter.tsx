import 'dart:convert';

import 'package:flutter/material.dart';

Track decodeTrack(String body) =>
    Track.fromJson(jsonDecode(body) as Map<String, dynamic>);

String billing(Track track) => track.title.toUpperCase();

class Track {
  const Track({required this.title, required this.year});

  factory Track.fromJson(Map<String, dynamic> json) =>
      Track(title: json['title'] as String, year: json['year'] as num);

  final String title;
  final num year;
}

class Shelf extends StatelessWidget {
  const Shelf({super.key, required this.payload});

  final String payload;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(billing(decodeTrack(payload))),
        Text('${decodeTrack(payload).year}'),
        Text(
          (Track.fromJson(jsonDecode(payload) as Map<String, dynamic>)).title,
        ),
      ],
    );
  }
}
