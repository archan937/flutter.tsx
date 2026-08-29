import 'package:flutter/material.dart';

class Job {
  const Job({required this.title, required this.remote});

  factory Job.fromJson(Map<String, dynamic> json) =>
      Job(title: json['title'] as String, remote: json['remote'] as bool);

  final String title;
  final bool remote;
}

class JobBoard extends StatelessWidget {
  const JobBoard({super.key, required this.jobs});

  final List<Job> jobs;

  @override
  Widget build(BuildContext context) {
    return Column(children: [for (final job in jobs) Text(job.title)]);
  }
}
