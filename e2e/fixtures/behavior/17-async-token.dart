import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/token_check.dart';

void main() {
  testWidgets('shows the loading state, then the resolved value', (
    tester,
  ) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{
      'token': 'abc',
    });

    await tester.pumpWidget(const MaterialApp(home: TokenCheck()));

    // The future has not completed on the first frame: the loading fallback
    // is what a user sees.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    expect(find.text('Signed in'), findsNothing);

    await tester.pumpAndSettle();
    expect(find.byType(CircularProgressIndicator), findsNothing);
    expect(find.text('Signed in'), findsOneWidget);
  });

  testWidgets('renders the empty case once resolved', (tester) async {
    FlutterSecureStorage.setMockInitialValues(<String, String>{});

    await tester.pumpWidget(const MaterialApp(home: TokenCheck()));
    await tester.pumpAndSettle();

    expect(find.text('Signed out'), findsOneWidget);
  });
}
