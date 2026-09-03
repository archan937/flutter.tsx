import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/backlog.dart';

void main() {
  testWidgets('the written table source pages through its rows', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Backlog()));

    // `rowCount` is three and `rowsPerPage` is two, so the first page holds
    // the first two rows the written `getRow` builds.
    expect(find.text('Step 1'), findsOneWidget);
    expect(find.text('Step 2'), findsOneWidget);
    expect(find.text('Step 3'), findsNothing);

    await tester.tap(find.byTooltip('Next page'));
    await tester.pumpAndSettle();

    expect(find.text('Step 3'), findsOneWidget);
    expect(find.text('Step 1'), findsNothing);
  });
}
