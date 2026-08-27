import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/fader.dart';

void main() {
  testWidgets('toggling the state drives the opacity animation', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Fader()));

    AnimatedOpacity fader() =>
        tester.widget<AnimatedOpacity>(find.byType(AnimatedOpacity));

    expect(fader().opacity, 1);
    expect(fader().duration, const Duration(milliseconds: 300));

    await tester.tap(find.text('Toggle'));
    await tester.pump();
    // The target changed, so the widget really animates rather than jumping.
    expect(fader().opacity, 0);

    await tester.pumpAndSettle();
    expect(fader().opacity, 0);
  });
}
