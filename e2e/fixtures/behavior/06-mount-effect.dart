import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/status.dart';

void main() {
  testWidgets('initState applies the mount effect and taps count up', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Status()));
    expect(find.text('Online'), findsOneWidget);
    expect(find.text('Offline'), findsNothing);
    expect(find.text('Checks: 0'), findsOneWidget);

    await tester.tap(find.text('Check'));
    await tester.pump();
    expect(find.text('Checks: 1'), findsOneWidget);
  });
}
