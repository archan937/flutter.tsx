import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/open_link.dart';
import 'package:plugin_platform_interface/plugin_platform_interface.dart';
import 'package:url_launcher_platform_interface/link.dart';
import 'package:url_launcher_platform_interface/url_launcher_platform_interface.dart';

class _RecordingLauncher extends UrlLauncherPlatform
    with MockPlatformInterfaceMixin {
  final List<String> launchedUrls = <String>[];
  final List<PreferredLaunchMode> launchedModes = <PreferredLaunchMode>[];

  @override
  LinkDelegate? get linkDelegate => null;

  @override
  Future<bool> launchUrl(String url, LaunchOptions options) async {
    launchedUrls.add(url);
    launchedModes.add(options.mode);
    return true;
  }
}

void main() {
  testWidgets('launches the url with the requested mode', (tester) async {
    final launcher = _RecordingLauncher();
    UrlLauncherPlatform.instance = launcher;

    await tester.pumpWidget(const MaterialApp(home: OpenLink()));
    await tester.pumpAndSettle();
    expect(find.text('Opened!'), findsNothing);

    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('Opened!'), findsOneWidget);
    expect(launcher.launchedUrls, <String>['https://flutter.dev']);
    expect(launcher.launchedModes, <PreferredLaunchMode>[
      PreferredLaunchMode.externalApplication,
    ]);
  });
}
