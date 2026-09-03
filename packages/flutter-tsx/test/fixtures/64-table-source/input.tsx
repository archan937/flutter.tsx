import {
  DataCell,
  DataColumn,
  DataRow,
  defineDelegate,
  PaginatedDataTable,
  Text,
} from 'flutter-tsx';

const titles = ['Ship step 21', 'Camera plugin', 'Write the docs'];

const rows = defineDelegate('DataTableSource', {
  rowCount: () => titles.length,
  isRowCountApproximate: () => false,
  selectedRowCount: () => 0,
  getRow: (self, index) =>
    new DataRow({
      cells: [new DataCell(<Text>{`Step ${index + 1}`}</Text>)],
    }),
});

export const Backlog = () => (
  <PaginatedDataTable
    source={rows}
    columns={[new DataColumn({ label: <Text>Step</Text> })]}
    rowsPerPage={2}
  />
);
