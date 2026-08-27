import 'package:flutter/material.dart';

class _CounterStore extends ChangeNotifier {
  _CounterStore({required this.count, required this.label});

  int count;
  String label;

  void update({int? count, String? label}) {
    if (count != null) {
      this.count = count;
    }
    if (label != null) {
      this.label = label;
    }
    notifyListeners();
  }
}

final _CounterStore _counterStore = _CounterStore(count: 0, label: 'Taps');

class StoreCounter extends StatelessWidget {
  const StoreCounter({super.key});

  void _increment() {
    _counterStore.update(count: _counterStore.count + 1);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: _counterStore,
      builder: (context, child) {
        return Column(
          children: [
            Text('${_counterStore.label}: ${_counterStore.count}'),
            ElevatedButton(
              onPressed: _increment,
              child: const Text('Increment'),
            ),
          ],
        );
      },
    );
  }
}
