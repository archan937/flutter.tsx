import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/material.dart';

class ConnectionBanner extends StatefulWidget {
  const ConnectionBanner({super.key});

  @override
  State<ConnectionBanner> createState() => _ConnectionBannerState();
}

class _ConnectionBannerState extends State<ConnectionBanner> {
  final Connectivity _connectivity = Connectivity();
  late final Stream<List<ConnectivityResult>> _statusStream;

  @override
  void initState() {
    super.initState();
    _statusStream = _connectivity.onConnectivityChanged;
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<ConnectivityResult>>(
      stream: _statusStream,
      builder: (context, snapshot) {
        if (snapshot.hasError) {
          final err = '${snapshot.error}';
          return Text(err);
        }
        if (!snapshot.hasData) {
          return const CircularProgressIndicator();
        }
        final status = snapshot.data!;
        return Text('Connections: ${status.length}');
      },
    );
  }
}
