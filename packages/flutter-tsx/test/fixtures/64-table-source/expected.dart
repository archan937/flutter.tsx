import 'package:flutter/material.dart';

const List<String> titles = ['Ship step 21', 'Camera plugin', 'Write the docs'];

class _Rows extends DataTableSource {
  @override
  int get rowCount => titles.length;

  @override
  bool get isRowCountApproximate => false;

  @override
  int get selectedRowCount => 0;

  @override
  DataRow? getRow(int index) =>
      DataRow(cells: [DataCell(Text('Step ${index + 1}'))]);
}

final _Rows _rows = _Rows();

class Backlog extends StatelessWidget {
  const Backlog({super.key});

  @override
  Widget build(BuildContext context) {
    return PaginatedDataTable(
      source: _rows,
      columns: const [DataColumn(label: Text('Step'))],
      rowsPerPage: 2,
    );
  }
}
