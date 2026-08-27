import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

class AlbumView extends StatefulWidget {
  const AlbumView({super.key});

  @override
  State<AlbumView> createState() => _AlbumViewState();
}

class _AlbumViewState extends State<AlbumView> {
  late final Future<http.Response> _resFuture;

  @override
  void initState() {
    super.initState();
    _resFuture = http.get(Uri.parse('https://example.com/album/1'));
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
        return Column(
          children: [Text('Status: ${res.statusCode}'), Text(res.body)],
        );
      },
    );
  }
}
