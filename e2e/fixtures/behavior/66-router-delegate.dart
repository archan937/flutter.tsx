import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/app_router.dart';

void main() {
  testWidgets('the written router delegate builds what the Router shows', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: AppRouter()));

    // A `RouterDelegate` is a `Listenable`; the generated class mixes in
    // `ChangeNotifier`, without which the Router would throw on attach.
    expect(find.text('Home'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
