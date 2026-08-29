import 'package:flutter/material.dart';

import 'user_card.dart';

class Directory extends StatelessWidget {
  const Directory({super.key});

  @override
  Widget build(BuildContext context) {
    return const Center(child: UserCard(name: 'Ada', admin: true));
  }
}
