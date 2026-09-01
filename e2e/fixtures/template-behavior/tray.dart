import 'dart:async';

import 'package:connectivity_plus_platform_interface/connectivity_plus_platform_interface.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:tray_app/app.dart';
import 'package:tray_app/stores/status.dart';

class _FakeConnectivity extends ConnectivityPlatform
    with MockPlatformInterfaceMixin {
  final StreamController<List<ConnectivityResult>> controller =
      StreamController<List<ConnectivityResult>>.broadcast();

  @override
  Stream<List<ConnectivityResult>> get onConnectivityChanged =>
      controller.stream;

  @override
  Future<List<ConnectivityResult>> checkConnectivity() async =>
      <ConnectivityResult>[ConnectivityResult.wifi];
}

/// Starts the app with a connectivity stream that is already producing.
///
/// The badge shows a spinner until the first value arrives, and a spinner
/// never settles — so the stream speaks first, and frames are pumped by hand.
Future<_FakeConnectivity> startApp(WidgetTester tester) async {
  final fake = _FakeConnectivity();
  ConnectivityPlatform.instance = fake;
  addTearDown(() => fake.controller.close());

  await tester.pumpWidget(const MaterialApp(home: App()));
  fake.controller.add(<ConnectivityResult>[ConnectivityResult.wifi]);
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
  return fake;
}

/// Delivers an event on the tray's channel, as the desktop side would.
Future<void> sendTrayEvent(String name) async {
  await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .handlePlatformMessage(
        'tray_manager',
        const StandardMethodCodec().encodeMethodCall(MethodCall(name)),
        (_) {},
      );
}

void main() {
  late List<MethodCall> trayCalls;

  setUp(() {
    trayCalls = <MethodCall>[];
    statusStore.update(
      lastEvent: 'waiting for the tray',
      clicks: 0,
      paused: false,
    );
    // The tray is a real platform channel; recording it is how a test sees
    // what the app asked the desktop to do.
    TestWidgetsFlutterBinding.ensureInitialized();
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
          const MethodChannel('tray_manager'),
          (call) async {
            trayCalls.add(call);
            return null;
          },
        );
  });

  testWidgets('sets its tooltip on mount and lists what it watches', (
    tester,
  ) async {
    await startApp(tester);

    expect(
      trayCalls.map((call) => call.method),
      contains('setToolTip'),
    );
    expect(find.text('flutter.dev'), findsOneWidget);
    expect(find.text('api.internal'), findsOneWidget);
    expect(find.text('1.8 s'), findsOneWidget);
  });

  testWidgets('a tray click reaches the window through the store', (
    tester,
  ) async {
    await startApp(tester);
    expect(find.text('waiting for the tray'), findsOneWidget);

    // The widget registered itself as the plugin's listener on mount, so an
    // event sent the way the desktop sends one arrives here.
    await sendTrayEvent('onTrayIconMouseDown');
    await tester.pump();

    expect(find.text('icon clicked'), findsOneWidget);
    expect(find.text('1 icon clicks'), findsOneWidget);
    expect(statusStore.clicks, 1);
  });

  testWidgets('pausing retitles the tray and the button', (tester) async {
    await startApp(tester);

    await tester.tap(find.text('Pause'));
    await tester.pump();

    expect(statusStore.paused, true);
    expect(find.text('Resume'), findsOneWidget);
    expect(
      trayCalls.where((call) => call.method == 'setToolTip').length,
      greaterThan(1),
    );
  });

  testWidgets('the connectivity stream renders each value it receives', (
    tester,
  ) async {
    final fake = await startApp(tester);

    expect(find.text('1 connection(s)'), findsOneWidget);

    fake.controller.add(<ConnectivityResult>[
      ConnectivityResult.wifi,
      ConnectivityResult.ethernet,
    ]);
    await tester.pump();
    await tester.pump();

    expect(find.text('2 connection(s)'), findsOneWidget);
  });
}
