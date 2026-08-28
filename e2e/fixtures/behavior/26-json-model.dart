import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:fsx_e2e_app/album_json.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

void main() {
  testWidgets('decodes the body into the generated model', (tester) async {
    final client = MockClient((request) async {
      return http.Response(
        '{"id": 7, "title": "Wish You Were Here", "tags": ["rock", "prog"], '
        '"author": {"name": "Pink Floyd"}}',
        200,
      );
    });

    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: AlbumDetail()));
      await tester.pumpAndSettle();

      // Fields come off the generated class, including the nested model.
      expect(find.text('Wish You Were Here'), findsOneWidget);
      expect(find.text('Pink Floyd'), findsOneWidget);
    }, () => client);
  });

  testWidgets('an absent optional field decodes to null', (tester) async {
    final client = MockClient((request) async {
      return http.Response(
        '{"id": 1, "title": "Untitled", "tags": [], '
        '"author": {"name": "Nobody"}}',
        200,
      );
    });

    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: AlbumDetail()));
      await tester.pumpAndSettle();

      // subtitle is optional and missing: decoding must not throw.
      expect(find.text('Untitled'), findsOneWidget);
    }, () => client);
  });

  testWidgets('an integer id decodes through num, not double', (tester) async {
    final client = MockClient((request) async {
      return http.Response(
        '{"id": 42, "title": "Integer", "tags": [], '
        '"author": {"name": "Someone"}}',
        200,
      );
    });

    await http.runWithClient(() async {
      await tester.pumpWidget(const MaterialApp(home: AlbumDetail()));
      await tester.pumpAndSettle();

      // `as double` would have thrown here; num accepts both JSON forms.
      expect(find.text('Integer'), findsOneWidget);
    }, () => client);
  });
}
