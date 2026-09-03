// Compile target: the transpiler reads the call from the AST and generates a
// Dart subclass; at TypeScript runtime it only has to be inert.

import type {
  DelegateImplementations,
  Delegates,
} from '../generated/delegates';

/** The classes an app writes itself, by name. */
export type DelegateName = keyof DelegateImplementations;

/**
 * Writes one of the classes Flutter leaves to an app.
 *
 * Most of Flutter is built or handed over. A `MultiChildLayoutDelegate`, a
 * `DataTableSource`, a `SliverPersistentHeaderDelegate` is neither: it
 * exists only as the subclass an app writes, which is what this writes.
 *
 * ```tsx
 * const rows = defineDelegate('DataTableSource', {
 *   rowCount: () => titles.length,
 *   isRowCountApproximate: () => false,
 *   selectedRowCount: () => 0,
 *   getRow: (self, index) =>
 *     new DataRow({
 *       cells: [new DataCell(<Text>{`Step ${index + 1}`}</Text>)],
 *     }),
 * });
 * ```
 *
 * Every member is handed the value itself first, so what the class inherits
 * is in reach: `self.layoutChild(…)` inside a layout delegate is the
 * superclass method of that name.
 */
export const defineDelegate = <TName extends DelegateName>(
  delegate: TName,
  implementation: DelegateImplementations[TName],
): Delegates[TName] => {
  throw new Error(
    `defineDelegate('${delegate}') is compile-time: ` +
      `${Object.keys(implementation).length} members were written.`,
  );
};
