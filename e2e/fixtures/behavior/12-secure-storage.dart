import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/vault.dart';

void main() {
  testWidgets('writes through the const service and really persists', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});

    await tester.pumpWidget(const MaterialApp(home: Vault()));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsNothing);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsOneWidget);

    const storage = FlutterSecureStorage();
    expect(await storage.read(key: 'token'), 'secret');
  });
}
