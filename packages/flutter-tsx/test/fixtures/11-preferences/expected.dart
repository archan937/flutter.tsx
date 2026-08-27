import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class Profile extends StatefulWidget {
  const Profile({super.key});

  @override
  State<Profile> createState() => _ProfileState();
}

class _ProfileState extends State<Profile> {
  SharedPreferences? _prefs;
  bool _saved = false;

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

  Future<void> _save() async {
    await _prefs?.setString('name', 'Paul');
    setState(() {
      _saved = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_saved) const Text('Saved!'),
        ElevatedButton(onPressed: _save, child: const Text('Save')),
      ],
    );
  }
}
