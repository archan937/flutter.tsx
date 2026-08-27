import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/router_pages.dart';

void main() {
  testWidgets('navigates between the routed pages', (tester) async {
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Detail'), findsNothing);

    await tester.tap(find.text('Open detail'));
    await tester.pumpAndSettle();
    expect(find.text('Detail'), findsOneWidget);
    expect(find.text('Home'), findsNothing);

    // pop() returns to the previous route, so the stack is real.
    await tester.tap(find.text('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Home'), findsOneWidget);
    expect(find.text('Detail'), findsNothing);
  });
}
