import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Home'),
        ElevatedButton(
          onPressed: () => context.push('/detail'),
          child: const Text('Open detail'),
        ),
      ],
    );
  }
}

class DetailPage extends StatelessWidget {
  const DetailPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text('Detail'),
        ElevatedButton(
          onPressed: () => context.pop(),
          child: const Text('Back'),
        ),
      ],
    );
  }
}

final GoRouter router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (context, state) => const HomePage()),
    GoRoute(path: '/detail', builder: (context, state) => const DetailPage()),
  ],
);
