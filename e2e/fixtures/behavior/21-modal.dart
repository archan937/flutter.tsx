import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/delete_button.dart';

void main() {
  testWidgets('present opens a dialog, presentSheet opens a sheet', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: DeleteButton()));
    expect(find.text('Delete this?'), findsNothing);
    expect(find.text('Asked'), findsNothing);

    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    // A real modal route was pushed: the dialog's content is on screen.
    expect(find.text('Delete this?'), findsOneWidget);
    expect(find.byType(AlertDialog), findsOneWidget);
    // The statement after the presentation still ran.
    expect(find.text('Asked'), findsOneWidget);

    // Tapping the barrier dismisses it, which only a modal route allows.
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
    expect(find.text('Delete this?'), findsNothing);

    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    expect(find.text('Options'), findsOneWidget);
  });
}
