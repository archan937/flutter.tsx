import 'package:flutter/material.dart';

class UserCard extends StatelessWidget {
  const UserCard({super.key, required this.name, required this.admin});

  final String name;
  final bool admin;

  @override
  Widget build(BuildContext context) {
    return Column(children: [Text(name), Text(admin ? 'admin' : 'member')]);
  }
}
