import 'package:flutter/material.dart';

class SearchBox extends StatefulWidget {
  const SearchBox({super.key});

  @override
  State<SearchBox> createState() => _SearchBoxState();
}

class _SearchBoxState extends State<SearchBox> {
  final TextEditingController _query = TextEditingController();
  final ScrollController _scroll = ScrollController();
  String _submitted = 'nothing yet';

  @override
  void dispose() {
    _query.dispose();
    _scroll.dispose();
    super.dispose();
  }

  void _submit() {
    setState(() {
      _submitted = 'searched';
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(controller: _query),
        ElevatedButton(onPressed: _submit, child: const Text('Search')),
        Text(_submitted),
        Expanded(
          child: ListView(
            controller: _scroll,
            children: const [Text('Result')],
          ),
        ),
      ],
    );
  }
}
