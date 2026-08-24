import 'package:flutter/material.dart';

class Groceries extends StatefulWidget {
  const Groceries({super.key});

  @override
  State<Groceries> createState() => _GroceriesState();
}

class _GroceriesState extends State<Groceries> {
  List<String> _items = ['Apples', 'Bread'];

  void _addItem() {
    setState(() {
      _items = [..._items, 'Milk'];
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        for (final item in _items) Text(item),
        ElevatedButton(onPressed: _addItem, child: const Text('Add')),
      ],
    );
  }
}
