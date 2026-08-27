import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/profile.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  testWidgets('saves through the singleton and really persists', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues(<String, Object>{});

    await tester.pumpWidget(const MaterialApp(home: Profile()));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsNothing);

    await tester.tap(find.text('Save'));
    await tester.pumpAndSettle();
    expect(find.text('Saved!'), findsOneWidget);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('name'), 'Paul');
  });
}
