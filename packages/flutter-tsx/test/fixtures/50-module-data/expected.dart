import 'package:flutter/material.dart';

class Keeper {
  const Keeper({required this.name});

  factory Keeper.fromJson(Map<String, dynamic> json) =>
      Keeper(name: json['name'] as String);

  final String name;
}

class Note {
  const Note({
    required this.id,
    required this.title,
    required this.tags,
    required this.keeper,
  });

  factory Note.fromJson(Map<String, dynamic> json) => Note(
    id: json['id'] as num,
    title: json['title'] as String,
    tags: (json['tags'] as List<dynamic>).cast<String>(),
    keeper: Keeper.fromJson(json['keeper'] as Map<String, dynamic>),
  );

  final num id;
  final String title;
  final List<String> tags;
  final Keeper keeper;
}

const List<Note> notes = [
  Note(
    id: 1,
    title: 'Pinned',
    tags: ['inbox'],
    keeper: Keeper(name: 'Ada'),
  ),
  Note(
    id: 2,
    title: 'Later',
    tags: ['someday', 'maybe'],
    keeper: Keeper(name: 'Grace'),
  ),
];

const String emptyLabel = 'Nothing here yet';

class NoteList extends StatelessWidget {
  const NoteList({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(emptyLabel),
        for (final note in notes) Text('${note.title} by ${note.keeper.name}'),
      ],
    );
  }
}
