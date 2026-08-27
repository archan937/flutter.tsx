import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/tap_target.dart';

void main() {
  testWidgets('the wrapped widget really receives taps', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: TapTarget()));
    expect(find.text('Taps: 0'), findsOneWidget);

    await tester.tap(find.text('Tap me'));
    await tester.pump();
    expect(find.text('Taps: 1'), findsOneWidget);

    await tester.longPress(find.text('Tap me'));
    await tester.pump();
    expect(find.text('Taps: 2'), findsOneWidget);
  });
}
