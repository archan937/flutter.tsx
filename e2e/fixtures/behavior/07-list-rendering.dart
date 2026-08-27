import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/groceries.dart';

void main() {
  testWidgets('renders the list and appends on tap', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Groceries()));
    expect(find.text('Apples'), findsOneWidget);
    expect(find.text('Bread'), findsOneWidget);
    expect(find.text('Milk'), findsNothing);

    await tester.tap(find.text('Add'));
    await tester.pump();
    expect(find.text('Milk'), findsOneWidget);
  });
}
