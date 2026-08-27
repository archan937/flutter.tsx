import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/counter.dart';

void main() {
  testWidgets('increments on tap', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Counter()));
    expect(find.text('Count: 0'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Count: 1'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Count: 2'), findsOneWidget);
  });
}
