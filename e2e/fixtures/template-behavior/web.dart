import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:web_app/routes.dart';
import 'package:web_app/stores/library.dart';

/// The album browser, driven the way a person drives it.
///
/// The router is the app's own, so a tap really navigates; the store is the
/// module-level one, so what one page writes the next page reads.
void main() {
  setUp(() {
    libraryStore.update(query: '', playingId: 1, plays: 0);
  });

  testWidgets('lists the library and filters it as you type', (tester) async {
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    expect(find.text('Kind of Blue'), findsOneWidget);
    expect(find.text('Homogenic'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Homo');
    await tester.pumpAndSettle();

    expect(find.text('Kind of Blue'), findsNothing);
    expect(find.text('Homogenic'), findsOneWidget);
  });

  testWidgets('opening an album routes to it and carries the selection', (
    tester,
  ) async {
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Selected Ambient Works'));
    await tester.pumpAndSettle();

    // The album page reads the store the list wrote, and shows that album.
    expect(find.text('Album'), findsOneWidget);
    expect(find.text('Aphex Twin'), findsOneWidget);
    expect(libraryStore.playingId, 2);
  });

  testWidgets('playing counts up, and back returns to the library', (
    tester,
  ) async {
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kind of Blue'));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Played 0 times'));
    await tester.pumpAndSettle();
    expect(find.text('Played 1 times'), findsOneWidget);

    await tester.tap(find.text('Back'));
    await tester.pumpAndSettle();
    expect(find.text('Library'), findsOneWidget);
  });
}
