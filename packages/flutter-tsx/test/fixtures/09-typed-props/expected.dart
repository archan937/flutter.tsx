import 'package:flutter/material.dart';

class Task extends StatelessWidget {
  const Task({super.key, required this.title, required this.done});

  final String title;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Text(done ? '✓ $title' : title);
  }
}

class TaskBoard extends StatefulWidget {
  const TaskBoard({super.key});

  @override
  State<TaskBoard> createState() => _TaskBoardState();
}

class _TaskBoardState extends State<TaskBoard> {
  final List<String> _titles = ['Ship step 21', 'Camera plugin'];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('${_titles.length} open tasks'),
        const Task(title: 'Write goldens', done: true),
        const Task(title: 'Trust the sweep', done: false),
      ],
    );
  }
}
