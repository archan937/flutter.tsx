import { describe, expect, test } from 'bun:test';

import {
  boolLit,
  call,
  closure,
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

  test('a call that fits its line prints inline', () => {
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
      "ElevatedButton(onPressed: _takePhoto, child: const Text('Take Photo'))",
    );
  });

  test('the same call past the 80-column limit prints tall', () => {
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
        { indent: 4, used: 14, trailing: 1 },
      ),
    ).toBe(
      [
        'ElevatedButton(',
        '      onPressed: _takePhoto,',
        "      child: const Text('Take Photo'),",
        '    )',
      ].join('\n'),
    );
  });

  test('inner arguments that fit stay inline within a tall call', () => {
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
        { indent: 0, used: 60, trailing: 0 },
      ),
    ).toBe(
      ['Center(', '  child: Column(children: [Spacer()]),', ')'].join('\n'),
    );
  });

  test('a collection argument splits whenever its call splits', () => {
    expect(
      printExpr(
        call('Column', [], {
          named: [
            {
              name: 'mainAxisAlignment',
              value: enumMember('MainAxisAlignment', 'spaceBetween'),
            },
            {
              name: 'children',
              value: listLit([{ kind: 'element', value: call('Spacer', []) }]),
            },
          ],
        }),
        { indent: 0, used: 2, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '  mainAxisAlignment: MainAxisAlignment.spaceBetween,',
        '  children: [',
        '    Spacer(),',
        '  ],',
        ')',
      ].join('\n'),
    );
  });
});

describe('printExpr — closures', () => {
  test('closures print their parameter list and empty body', () => {
    expect(printExpr(closure([]))).toBe('() {}');
    expect(printExpr(closure(['_']))).toBe('(_) {}');
    expect(printExpr(closure(['value', 'index']))).toBe('(value, index) {}');
  });
});

describe('printExpr — width edge cases', () => {
  test('an atom past the limit still prints inline (atoms cannot split)', () => {
    expect(
      printExpr(identifier('averyLongIdentifier'), {
        indent: 0,
        used: 78,
        trailing: 1,
      }),
    ).toBe('averyLongIdentifier');
  });

  test('an empty list argument stays inline inside a tall call', () => {
    expect(
      printExpr(
        call('Column', [], {
          named: [
            {
              name: 'mainAxisAlignment',
              value: enumMember('MainAxisAlignment', 'spaceBetween'),
            },
            { name: 'children', value: listLit([]) },
          ],
        }),
        { indent: 0, used: 20, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '  mainAxisAlignment: MainAxisAlignment.spaceBetween,',
        '  children: [],',
        ')',
      ].join('\n'),
    );
  });
});

describe('printExpr — lists and collection-if', () => {
  test('an empty list prints inline', () => {
    expect(printExpr(listLit([]))).toBe('[]');
  });

  test('a fitting list prints inline, collection-if included', () => {
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
    ).toBe("[if (_taken) const Text('Photo saved!'), Spacer()]");
  });

  test('a list past the limit prints tall with collection-if elements', () => {
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
        { indent: 0, used: 40, trailing: 1 },
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
