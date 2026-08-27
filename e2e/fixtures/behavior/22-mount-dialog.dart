import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/onboarding.dart';

void main() {
  testWidgets('a mount effect may present, one frame later', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Onboarding()));

    // Presenting during initState throws in Flutter; the post-frame callback
    // is why this renders at all.
    expect(find.text('Onboarding'), findsOneWidget);
    expect(find.text('Welcome!'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.text('Welcome!'), findsOneWidget);
    expect(find.byType(AlertDialog), findsOneWidget);
    // The statement after the presentation ran inside the same callback.
    expect(find.text('Greeted'), findsOneWidget);
  });
}
