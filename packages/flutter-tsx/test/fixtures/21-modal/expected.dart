import 'package:flutter/material.dart';

class ConfirmDialog extends StatelessWidget {
  const ConfirmDialog({super.key});

  @override
  Widget build(BuildContext context) {
    return const AlertDialog(title: Text('Delete this?'));
  }
}

class SheetBody extends StatelessWidget {
  const SheetBody({super.key});

  @override
  Widget build(BuildContext context) {
    return const Text('Options');
  }
}

class DeleteButton extends StatefulWidget {
  const DeleteButton({super.key});

  @override
  State<DeleteButton> createState() => _DeleteButtonState();
}

class _DeleteButtonState extends State<DeleteButton> {
  bool _asked = false;

  void _confirm() {
    showDialog(context: context, builder: (context) => const ConfirmDialog());
    setState(() {
      _asked = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        if (_asked) const Text('Asked'),
        ElevatedButton(onPressed: _confirm, child: const Text('Delete')),
        ElevatedButton(
          onPressed: () => showModalBottomSheet(
            context: context,
            builder: (context) => const SheetBody(),
          ),
          child: const Text('More'),
        ),
      ],
    );
  }
}
