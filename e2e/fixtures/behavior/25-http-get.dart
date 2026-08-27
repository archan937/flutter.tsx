import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/album_view.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('renders the fetched response', (tester) async {
    final requested = <Uri>[];
    final client = MockClient((request) async {
      requested.add(request.url);
      return http.Response('{"title":"Hello"}', 200);
    });

    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: AlbumView()));

      // The request is in flight on the first frame.
      expect(find.byType(CircularProgressIndicator), findsOneWidget);

      await tester.pumpAndSettle();
      expect(find.text('Status: 200'), findsOneWidget);
      expect(find.text('{"title":"Hello"}'), findsOneWidget);
    }, () => client);

    // The generated Dart really called the URL from the TSX.
    expect(requested, <Uri>[Uri.parse('https://example.com/album/1')]);
  });

  testWidgets('renders the error fallback when the request fails', (
    tester,
  ) async {
    final client = MockClient((request) async {
      throw http.ClientException('offline', request.url);
    });

    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: AlbumView()));
      await tester.pumpAndSettle();

      expect(find.textContaining('offline'), findsOneWidget);
    }, () => client);
  });
}
