import 'package:flutter/material.dart';

class _Routes extends RouterDelegate<Object> with ChangeNotifier {
  @override
  Widget build(BuildContext context) => const Center(child: Text('Home'));

  @override
  Future<bool> popRoute() async => false;

  @override
  Future<void> setNewRoutePath(Object configuration) async {}
}

final _Routes _routes = _Routes();

class AppRouter extends StatelessWidget {
  const AppRouter({super.key});

  @override
  Widget build(BuildContext context) {
    return Router(routerDelegate: _routes);
  }
}
