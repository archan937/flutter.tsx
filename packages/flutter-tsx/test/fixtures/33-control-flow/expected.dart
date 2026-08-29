import 'package:flutter/material.dart';

class Auditor extends StatefulWidget {
  const Auditor({super.key, required this.entries});

  final List<String> entries;

  @override
  State<Auditor> createState() => _AuditorState();
}

class _AuditorState extends State<Auditor> {
  String _status = 'idle';
  int _seen = 0;

  void _audit() {
    try {
      for (final entry in widget.entries) {
        setState(() {
          _status = entry.trim();
          _seen++;
        });
      }
      switch (_seen) {
        case 0:
          setState(() {
            _status = 'empty';
          });
          break;
        case 1:
        case 2:
          setState(() {
            _status = 'sparse';
          });
          break;
        default:
          setState(() {
            _status = 'full';
          });
      }
    } catch (_) {
      setState(() {
        _status = 'failed';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_status),
        ElevatedButton(onPressed: _audit, child: const Text('Audit')),
      ],
    );
  }
}
