import 'package:flutter/material.dart';

class Scroller extends StatefulWidget {
  const Scroller({super.key});

  @override
  State<Scroller> createState() => _ScrollerState();
}

class _ScrollerState extends State<Scroller> {
  final ScrollController _scroll = ScrollController();
  final TextEditingController _query = TextEditingController();

  @override
  void dispose() {
    _scroll.dispose();
    _query.dispose();
    super.dispose();
  }

  void _top() {
    _scroll.jumpTo(0);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ElevatedButton(onPressed: _top, child: const Text('Back to top')),
        RichText(
          text: _query.buildTextSpan(context: context, withComposing: false),
        ),
        ListView(
          controller: _scroll,
          children: const [Text('One'), Text('Two')],
        ),
      ],
    );
  }
}
