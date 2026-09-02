import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SavedGreeting extends StatefulWidget {
  const SavedGreeting({super.key});

  @override
  State<SavedGreeting> createState() => _SavedGreetingState();
}

class _SavedGreetingState extends State<SavedGreeting> {
  SharedPreferences? _prefs;
  String _message = 'nothing loaded';
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _initPrefs();
  }

  Future<void> _initPrefs() async {
    final instance = await SharedPreferences.getInstance();
    if (!mounted) {
      return;
    }
    setState(() {
      _prefs = instance;
    });
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
    });
    try {
      await _prefs?.reload();
      setState(() {
        _message = _prefs?.getString('greeting') ?? 'nothing saved';
      });
    } catch (error) {
      setState(() {
        _message = error.toString();
      });
    } finally {
      setState(() {
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(_message),
        ElevatedButton(
          onPressed: _load,
          child: _busy ? const Text('Loading…') : const Text('Load'),
        ),
      ],
    );
  }
}
