import { describe, expect, test } from 'bun:test';

import {
  boolLit,
  call,
  enumMember,
  identifier,
  listLit,
  numberLit,
  stringLit,
} from '@src/compiler/dart-ast';
import { printExpr } from '@src/compiler/dart-print';

describe('printExpr — literals and identifiers', () => {
  test('scalars', () => {
    expect(printExpr(stringLit('hi'))).toBe("'hi'");
    expect(printExpr(numberLit('1.5'))).toBe('1.5');
    expect(printExpr(boolLit(true))).toBe('true');
    expect(printExpr(identifier('_taken'))).toBe('_taken');
    expect(printExpr(enumMember('MainAxisAlignment', 'center'))).toBe(
      'MainAxisAlignment.center',
    );
  });

  test('strings escape quotes and dollars', () => {
    expect(printExpr(stringLit("it's"))).toBe("'it\\'s'");
    expect(printExpr(stringLit('cost $5'))).toBe("'cost \\$5'");
  });
});

describe('printExpr — calls', () => {
  test('no arguments prints inline', () => {
    expect(printExpr(call('Spacer', []))).toBe('Spacer()');
  });

  test('a single simple argument prints inline', () => {
    expect(printExpr(call('Text', [stringLit('hi')], { isConst: true }))).toBe(
      "const Text('hi')",
    );
  });

  test('multiple arguments print tall with trailing commas', () => {
    expect(
      printExpr(
        call('ElevatedButton', [], {
          named: [
            { name: 'onPressed', value: identifier('_takePhoto') },
            {
              name: 'child',
              value: call('Text', [stringLit('Take Photo')], {
                isConst: true,
              }),
            },
          ],
        }),
      ),
    ).toBe(
      [
        'ElevatedButton(',
        '  onPressed: _takePhoto,',
        "  child: const Text('Take Photo'),",
        ')',
      ].join('\n'),
    );
  });

  test('nested tall arguments indent correctly', () => {
    expect(
      printExpr(
        call('Center', [], {
          named: [
            {
              name: 'child',
              value: call('Column', [], {
                named: [
                  {
                    name: 'children',
                    value: listLit([
                      { kind: 'element', value: call('Spacer', []) },
                    ]),
                  },
                ],
              }),
            },
          ],
        }),
      ),
    ).toBe(
      [
        'Center(',
        '  child: Column(',
        '    children: [',
        '      Spacer(),',
        '    ],',
        '  ),',
        ')',
      ].join('\n'),
    );
  });
});

describe('printExpr — lists and collection-if', () => {
  test('an empty list prints inline', () => {
    expect(printExpr(listLit([]))).toBe('[]');
  });

  test('items print tall with collection-if elements', () => {
    expect(
      printExpr(
        listLit([
          {
            kind: 'if',
            condition: identifier('_taken'),
            value: call('Text', [stringLit('Photo saved!')], {
              isConst: true,
            }),
          },
          { kind: 'element', value: call('Spacer', []) },
        ]),
      ),
    ).toBe(
      [
        '[',
        "  if (_taken) const Text('Photo saved!'),",
        '  Spacer(),',
        ']',
      ].join('\n'),
    );
  });
});
