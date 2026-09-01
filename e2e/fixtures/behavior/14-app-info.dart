import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/app_info.dart';
import 'package:package_info_plus/package_info_plus.dart';

void main() {
  testWidgets('renders properties read off the resolved handle', (
    tester,
  ) async {
    PackageInfo.setMockInitialValues(
      appName: 'Flutter.tsx Demo',
      packageName: 'dev.fluttertsx.demo',
      version: '4.2.0',
      buildNumber: '7',
      buildSignature: 'sig',
    );

    await tester.pumpWidget(const MaterialApp(home: AppInfo()));

    // The guard renders until the singleton resolves, so nothing reads a
    // handle that is not there yet.
    expect(find.text('Flutter.tsx Demo'), findsNothing);
    expect(find.text('Loading…'), findsOneWidget);

    await tester.pumpAndSettle();
    expect(find.text('Flutter.tsx Demo'), findsOneWidget);
    expect(find.text('v4.2.0'), findsOneWidget);
  });
}
