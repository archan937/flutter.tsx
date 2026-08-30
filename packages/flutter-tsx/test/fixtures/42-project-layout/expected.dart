import 'package:flutter/material.dart';

import 'playlist.dart';
import 'song.dart';

class NowPlaying extends StatelessWidget {
  const NowPlaying({super.key, required this.song});

  final Song song;

  void _play() {
    playlistStore.update(plays: playlistStore.plays + 1);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: playlistStore,
      builder: (context, child) {
        return Column(
          children: [
            Text(song.title),
            Text('Played: ${playlistStore.plays}'),
            ElevatedButton(onPressed: _play, child: const Text('Play')),
          ],
        );
      },
    );
  }
}
