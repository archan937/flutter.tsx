import 'package:flutter/material.dart';

class PlaylistStore extends ChangeNotifier {
  PlaylistStore({required this.plays});

  int plays;

  void update({int? plays}) {
    if (plays != null) {
      this.plays = plays;
    }
    notifyListeners();
  }
}

final PlaylistStore playlistStore = PlaylistStore(plays: 0);
