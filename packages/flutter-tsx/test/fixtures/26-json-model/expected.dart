import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class Author {
  const Author({required this.name});

  factory Author.fromJson(Map<String, dynamic> json) =>
      Author(name: json['name'] as String);

  final String name;
}

class Album {
  const Album({
    required this.id,
    required this.title,
    required this.tags,
    required this.author,
    this.subtitle,
  });

  factory Album.fromJson(Map<String, dynamic> json) => Album(
    id: json['id'] as num,
    title: json['title'] as String,
    tags: (json['tags'] as List<dynamic>).cast<String>(),
    author: Author.fromJson(json['author'] as Map<String, dynamic>),
    subtitle: json['subtitle'] as String?,
  );

  final num id;
  final String title;
  final List<String> tags;
  final Author author;
  final String? subtitle;
}

class AlbumDetail extends StatefulWidget {
  const AlbumDetail({super.key});

  @override
  State<AlbumDetail> createState() => _AlbumDetailState();
}

class _AlbumDetailState extends State<AlbumDetail> {
  late final Future<http.Response> _resFuture;

  @override
  void initState() {
    super.initState();
    _resFuture = http.get(Uri.parse('https://example.com/albums/1'));
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<http.Response>(
      future: _resFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          final err = '${snapshot.error}';
          return Text(err);
        }
        if (!snapshot.hasData) {
          return const CircularProgressIndicator();
        }
        final res = snapshot.data!;
        final album = Album.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>,
        );
        return Column(children: [Text(album.title), Text(album.author.name)]);
      },
    );
  }
}
