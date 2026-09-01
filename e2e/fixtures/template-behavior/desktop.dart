import 'package:desktop_app/app.dart';
import 'package:desktop_app/components/sidebar.dart';
import 'package:desktop_app/stores/console.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// The service console, driven the way a person drives it.
/// Rows in the sidebar, not the deployment rows the detail pane also lists.
final sidebarRows = find.descendant(
  of: find.byType(Sidebar),
  matching: find.byType(ListTile),
);

void main() {
  // A desktop window, not the 800x600 the test binding defaults to: the
  // sidebar list is as long as the window lets it be.
  setUp(() {
    final view = TestWidgetsFlutterBinding.ensureInitialized()
        .platformDispatcher
        .views
        .first;
    view.physicalSize = const Size(1600, 1200);
    view.devicePixelRatio = 1;
    addTearDown(view.resetPhysicalSize);
    addTearDown(view.resetDevicePixelRatio);

    consoleStore.update(selectedId: 1, query: '', section: 0, refreshes: 0);
    PackageInfo.setMockInitialValues(
      appName: 'Console',
      packageName: 'dev.fluttertsx.console',
      version: '2.1.0',
      buildNumber: '44',
      buildSignature: 'sig',
    );
  });

  testWidgets('the sidebar lists services and the pane shows the open one', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pumpAndSettle();

    expect(find.text('checkout-api'), findsWidgets);
    expect(sidebarRows, findsNWidgets(4));
    expect(find.text('edge-cache'), findsOneWidget);
    // The detail pane opened the selected service, and read its numbers.
    expect(find.text('eu-west-1 · 12.5k/min · 0.4% errors'), findsOneWidget);
  });

  testWidgets('selecting in the sidebar changes the pane', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('billing-worker'));
    await tester.pumpAndSettle();

    expect(consoleStore.selectedId, 3);
    expect(find.text('us-east-1 · 60/min · 6.2% errors'), findsOneWidget);
    // Its error rate is over the line, so the chip says so.
    expect(find.text('failing'), findsWidgets);
  });

  testWidgets('filtering hides what does not match', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), 'edge');
    await tester.pumpAndSettle();

    // One row is left in the sidebar. `checkout-api` is still on screen —
    // the detail pane keeps showing the service that is open.
    expect(sidebarRows, findsOneWidget);
    expect(find.text('edge-cache'), findsOneWidget);
  });

  testWidgets('the footer reads the running build', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pumpAndSettle();

    expect(find.text('Console'), findsOneWidget);
    expect(find.text('v2.1.0 (44)'), findsOneWidget);
  });

  testWidgets('refreshing counts, and the fade appears with it', (
    tester,
  ) async {
    await tester.pumpWidget(const MaterialApp(home: App()));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Refresh'));
    await tester.pumpAndSettle();

    expect(consoleStore.refreshes, 1);
    expect(find.text('Refreshed 1 times this session'), findsOneWidget);
  });
}
