import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class TokenCheck extends StatefulWidget {
  const TokenCheck({super.key});

  @override
  State<TokenCheck> createState() => _TokenCheckState();
}

class _TokenCheckState extends State<TokenCheck> {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  late final Future<bool> _hasTokenFuture;

  @override
  void initState() {
    super.initState();
    _hasTokenFuture = _storage.containsKey(key: 'token');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<bool>(
      future: _hasTokenFuture,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          final err = '${snapshot.error}';
          return Text(err);
        }
        if (!snapshot.hasData) {
          return const CircularProgressIndicator();
        }
        final hasToken = snapshot.data!;
        return Text(hasToken ? 'Signed in' : 'Signed out');
      },
    );
  }
}
