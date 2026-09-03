import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/feed.dart';

void main() {
  testWidgets('the written header delegate builds at its own extent', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: Feed()));

    // The header is built with the offset it has been scrolled by, which is
    // nothing yet, and it is given room for the `maxExtent` the written
    // getter returns.
    expect(find.text('Scrolled 0.0'), findsOneWidget);
    expect(tester.getSize(find.byType(Center)).height, 96);
    expect(tester.takeException(), isNull);
  });
}
