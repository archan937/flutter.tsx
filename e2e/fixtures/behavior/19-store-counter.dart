import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/store_counter.dart';

void main() {
  testWidgets('the store drives rebuilds of a stateless widget', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: StoreCounter()));
    expect(find.text('Taps: 0'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Taps: 1'), findsOneWidget);

    await tester.tap(find.text('Increment'));
    await tester.pump();
    expect(find.text('Taps: 2'), findsOneWidget);
  });

  testWidgets('two widgets on one store see the same value', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Column(children: [StoreCounter(), StoreCounter()]),
      ),
    );

    // The store is module-level, so the counter carried over from the tap
    // above is shared — both widgets render whatever it holds now.
    final texts = tester
        .widgetList<Text>(find.textContaining('Taps: '))
        .map((widget) => widget.data)
        .toSet();
    expect(texts, hasLength(1));

    await tester.tap(find.text('Increment').first);
    await tester.pump();

    final updated = tester
        .widgetList<Text>(find.textContaining('Taps: '))
        .map((widget) => widget.data)
        .toSet();
    expect(updated, hasLength(1));
    expect(updated.first, isNot(texts.first));
  });
}
