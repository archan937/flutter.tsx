import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Vault extends StatefulWidget {
  const Vault({super.key});

  @override
  State<Vault> createState() => _VaultState();
}

class _VaultState extends State<Vault> {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  bool _saved = false;

  Future<void> _save() async {
    await _storage.write(key: 'token', value: 'secret');
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
