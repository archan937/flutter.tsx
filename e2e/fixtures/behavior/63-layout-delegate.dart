import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/ribbon.dart';

void main() {
  testWidgets('the written layout delegate lays its child out', (tester) async {
    // `MultiChildLayoutDelegate` asserts in debug that every child with an id
    // was laid out and positioned, so this passes only if the generated
    // `performLayout` really called both.
    await tester.pumpWidget(
      const MaterialApp(
        home: Center(child: SizedBox(width: 200, height: 100, child: Ribbon())),
      ),
    );

    expect(find.text('New'), findsOneWidget);
    expect(tester.takeException(), isNull);

    // The child was positioned at the bottom of the 100-pixel box, which is
    // what `positionChild('label', Offset(0, size.height - label.height))`
    // asks for.
    final box = tester.getRect(find.byType(Ribbon));
    final label = tester.getRect(find.text('New'));
    expect(label.bottom, box.bottom);
    expect(label.left, box.left);
  });
}
