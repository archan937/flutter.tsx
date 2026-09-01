import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/app.dart';
import 'package:mobile_app/stores/notebook.dart';

/// The field-notes app, driven the way a person drives it.
///
/// There is no camera in a test, so the capture tab renders its guard — which
/// is the branch that matters: the preview waits until the controller exists
/// rather than reading a handle that is not there.
void main() {
  setUp(() {
    notebookStore.update(
      query: '',
      lastPhotoPath: '',
      savedKey: '',
      captures: 0,
    );
    FlutterSecureStorage.setMockInitialValues(<String, String>{});
  });

  testWidgets('opens on the notes, and filters them as you type', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pump();

    expect(find.text('Bridge inspection'), findsOneWidget);
    expect(find.text('Soil samples'), findsOneWidget);
    expect(find.text('3 notes on this device'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Soil');
    await tester.pump();

    expect(find.text('Bridge inspection'), findsNothing);
    expect(find.text('Soil samples'), findsOneWidget);
  });

  testWidgets('a note opens in a sheet with its whole body', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pump();

    // The list shows a truncated preview; the sheet shows all of it.
    expect(
      find.text('Handrail is loose on the north side; photogra…'),
      findsOneWidget,
    );

    await tester.tap(find.text('Bridge inspection'));
    await tester.pumpAndSettle();

    expect(
      find.text('Handrail is loose on the north side; photographed the bolt.'),
      findsOneWidget,
    );
    expect(find.text('site · urgent'), findsOneWidget);
  });

  testWidgets('the tabs switch, and each keeps what it had', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pump();

    await tester.enterText(find.byType(TextField).first, 'Soil');
    await tester.pump();

    await tester.tap(find.text('Capture'));
    await tester.pumpAndSettle();
    expect(find.text('0 captured this session'), findsOneWidget);

    await tester.tap(find.text('Notes'));
    await tester.pumpAndSettle();
    // The tab was kept alive, so the filter typed into it is still there.
    expect(find.text('Bridge inspection'), findsNothing);
    expect(find.text('Soil samples'), findsOneWidget);
  });

  testWidgets('the vault writes to the keychain and says so', (tester) async {
    notebookStore.update(lastPhotoPath: '/tmp/photo.jpg');

    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pump();

    await tester.tap(find.text('Vault'));
    await tester.pumpAndSettle();
    expect(find.text('Nothing stored'), findsOneWidget);

    await tester.tap(find.text('Store the last photo path'));
    await tester.pumpAndSettle();

    const storage = FlutterSecureStorage();
    expect(await storage.read(key: 'field-key'), '/tmp/photo.jpg');
    expect(find.text('field-key'), findsOneWidget);
  });
}
