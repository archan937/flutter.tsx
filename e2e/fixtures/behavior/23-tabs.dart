import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/tab_shell.dart';

void main() {
  testWidgets('the bar switches pages and keeps both alive', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Shell()));

    // IndexedStack keeps every page mounted, so both exist from the start;
    // only one is visible.
    expect(find.text('Home'), findsWidgets);
    expect(find.byType(IndexedStack), findsOneWidget);
    expect(tester.widget<IndexedStack>(find.byType(IndexedStack)).index, 0);

    await tester.tap(find.text('Profile').last);
    await tester.pumpAndSettle();
    expect(tester.widget<IndexedStack>(find.byType(IndexedStack)).index, 1);

    await tester.tap(find.text('Home').last);
    await tester.pumpAndSettle();
    expect(tester.widget<IndexedStack>(find.byType(IndexedStack)).index, 0);
  });
}
