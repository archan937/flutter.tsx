import 'dart:async';

import 'package:connectivity_plus_platform_interface/connectivity_plus_platform_interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/connection_banner.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';

class _FakeConnectivity extends ConnectivityPlatform
    with MockPlatformInterfaceMixin {
  final StreamController<List<ConnectivityResult>> controller =
      StreamController<List<ConnectivityResult>>();

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      controller.stream;

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async {
    return <ConnectivityResult>[ConnectivityResult.wifi];
  }
}

void main() {
  testWidgets('rebuilds on every stream event', (tester) async {
    final fake = _FakeConnectivity();
    ConnectivityPlatform.instance = fake;
    addTearDown(() => fake.controller.close());

    await tester.pumpWidget(const MaterialApp(home: ConnectionBanner()));

    // Nothing has been emitted yet: the loading fallback is what renders.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    fake.controller.add(<ConnectivityResult>[ConnectivityResult.wifi]);
    await tester.pumpAndSettle();
    expect(find.text('Connections: 1'), findsOneWidget);

    // A second event rebuilds with the new value — a stream, not a future.
    fake.controller.add(<ConnectivityResult>[
      ConnectivityResult.wifi,
      ConnectivityResult.mobile,
    ]);
    await tester.pumpAndSettle();
    expect(find.text('Connections: 2'), findsOneWidget);
  });
}
