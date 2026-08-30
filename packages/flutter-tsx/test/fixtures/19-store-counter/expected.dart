import 'package:flutter/material.dart';

class CounterStore extends ChangeNotifier {
  CounterStore({required this.count, required this.label});

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

final CounterStore counterStore = CounterStore(count: 0, label: 'Taps');

class StoreCounter extends StatelessWidget {
  const StoreCounter({super.key});

  void _increment() {
    counterStore.update(count: counterStore.count + 1);
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: counterStore,
      builder: (context, child) {
        return Column(
          children: [
            Text('${counterStore.label}: ${counterStore.count}'),
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
