class Song {
  const Song({required this.title, required this.seconds});

  factory Song.fromJson(Map<String, dynamic> json) =>
      Song(title: json['title'] as String, seconds: json['seconds'] as num);

  final String title;
  final num seconds;
}
