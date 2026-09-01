import 'package:flutter/material.dart';

String label(num seconds) => '${seconds}s';

class Segment {
  const Segment({required this.id, required this.seconds});

  factory Segment.fromJson(Map<String, dynamic> json) =>
      Segment(id: json['id'] as num, seconds: json['seconds'] as num);

  final num id;
  final num seconds;
}

class SegmentRow extends StatefulWidget {
  const SegmentRow({super.key, required this.segment});

  final Segment segment;

  @override
  State<SegmentRow> createState() => _SegmentRowState();
}

class _SegmentRowState extends State<SegmentRow> {
  final int _width = 120;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text('Segment ${widget.segment.id}'),
        SizedBox(
          width: _width.toDouble(),
          height: widget.segment.seconds.toDouble(),
          child: Text(label(widget.segment.seconds)),
        ),
      ],
    );
  }
}
