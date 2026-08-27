import { describe, expect, test } from 'bun:test';

import {
  boolLit,
  builderClosure,
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

  // Verified against dart format: it collapses a hand-split collection whose
  // elements carry no named arguments, in a multi-argument call too.
  test('a fitting collection argument stays inline even in a split call', () => {
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
        '  children: [Spacer()],',
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

  test('expression bodies print as arrows', () => {
    expect(
      printExpr(
        closure([], { kind: 'expression', code: 'setState(() => _count++)' }),
      ),
    ).toBe('() => setState(() => _count++)');
  });

  test('block bodies indent at the closure site', () => {
    expect(
      printExpr(
        closure(['value'], {
          kind: 'block',
          lines: ['setState(() {', '  _a++;', '});'],
        }),
        { indent: 2, used: 13, trailing: 1 },
      ),
    ).toBe(
      ['(value) {', '    setState(() {', '      _a++;', '    });', '  }'].join(
        '\n',
      ),
    );
  });
});

describe('printExpr — conditionals', () => {
  test('fitting conditionals print inline', () => {
    expect(
      printExpr({
        kind: 'conditional',
        condition: identifier('_online'),
        whenTrue: call('Text', [stringLit('Online')], { isConst: true }),
        whenFalse: call('Text', [stringLit('Offline')], { isConst: true }),
      }),
    ).toBe("_online ? const Text('Online') : const Text('Offline')");
  });

  test('conditionals past the limit split before ? and :', () => {
    expect(
      printExpr(
        {
          kind: 'conditional',
          condition: identifier('_online'),
          whenTrue: call('Text', [stringLit('Online')], { isConst: true }),
          whenFalse: call('Text', [stringLit('Offline')], { isConst: true }),
        },
        { indent: 8, used: 30, trailing: 1 },
      ),
    ).toBe(
      [
        '_online',
        "            ? const Text('Online')",
        "            : const Text('Offline')",
      ].join('\n'),
    );
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

describe('printExpr — collection-for', () => {
  test('for items print their loop header inline with the element', () => {
    expect(
      printExpr(
        listLit([
          {
            kind: 'for',
            itemName: 'item',
            iterable: identifier('_items'),
            value: call('Text', [identifier('item')]),
          },
          { kind: 'element', value: call('Spacer', []) },
        ]),
        { indent: 0, used: 40, trailing: 1 },
      ),
    ).toBe(
      [
        '[',
        '  for (final item in _items) Text(item),',
        '  Spacer(),',
        ']',
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
// dart format (dart_style 3.x tall style) hugs a SOLE block-like argument:
// the collection stays on the argument line when it fits there, and an
// author's split is collapsed. With more than one argument a split
// collection is preserved instead — the shape every multi-arg golden has.
describe('printExpr — sole collection argument hugs', () => {
  const twoTexts = listLit([
    { kind: 'element', value: call('Text', [identifier("_a ?? ''")]) },
    { kind: 'element', value: call('Text', [identifier("_b ?? ''")]) },
  ]);

  test('a fitting sole collection argument stays on its line', () => {
    expect(
      printExpr(
        call('Column', [], { named: [{ name: 'children', value: twoTexts }] }),
        { indent: 4, used: 45, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        "      children: [Text(_a ?? ''), Text(_b ?? '')],",
        '    )',
      ].join('\n'),
    );
  });

  test('an overlong sole collection argument still splits', () => {
    const wide = listLit([
      {
        kind: 'element',
        value: call('Text', [stringLit('a'.repeat(70))]),
      },
      { kind: 'element', value: call('Text', [stringLit('b')]) },
    ]);
    expect(
      printExpr(
        call('Column', [], { named: [{ name: 'children', value: wide }] }),
        { indent: 4, used: 45, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '      children: [',
        '        Text(',
        `          '${'a'.repeat(70)}',`,
        '        ),',
        "        Text('b'),",
        '      ],',
        '    )',
      ].join('\n'),
    );
  });

  test('an element with named arguments blocks the hug', () => {
    const namedElements = listLit([
      {
        kind: 'element',
        value: call('Greeting', [], {
          named: [{ name: 'name', value: stringLit('Paul') }],
        }),
      },
      {
        kind: 'element',
        value: call('Greeting', [], {
          named: [{ name: 'name', value: stringLit('World') }],
        }),
      },
    ]);
    expect(
      printExpr(
        call('Column', [], {
          named: [{ name: 'children', value: namedElements }],
        }),
        { indent: 4, used: 45, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '      children: [',
        "        Greeting(name: 'Paul'),",
        "        Greeting(name: 'World'),",
        '      ],',
        '    )',
      ].join('\n'),
    );
  });

  test('named arguments nested deeper still allow the hug', () => {
    const nested = listLit([
      {
        kind: 'element',
        value: call('Text', [
          call('fmt', [], { named: [{ name: 'pad', value: numberLit('2') }] }),
        ]),
      },
      { kind: 'element', value: call('Text', [identifier('_b')]) },
    ]);
    expect(
      printExpr(
        call('Column', [], { named: [{ name: 'children', value: nested }] }),
        { indent: 4, used: 45, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '      children: [Text(fmt(pad: 2)), Text(_b)],',
        '    )',
      ].join('\n'),
    );
  });

  test('a second argument does not force a fitting collection to split', () => {
    expect(
      printExpr(
        call('Column', [], {
          named: [
            {
              name: 'mainAxisAlignment',
              value: enumMember('MainAxisAlignment', 'center'),
            },
            { name: 'children', value: twoTexts },
          ],
        }),
        { indent: 4, used: 11, trailing: 1 },
      ),
    ).toBe(
      [
        'Column(',
        '      mainAxisAlignment: MainAxisAlignment.center,',
        "      children: [Text(_a ?? ''), Text(_b ?? '')],",
        '    )',
      ].join('\n'),
    );
  });
});
// A builder closure is always tall: guarded early returns, then the
// fall-through. FutureBuilder and StreamBuilder both render through it.
describe('printExpr — builder closures', () => {
  test('guards, bindings and the fall-through print as a block', () => {
    const builder = builderClosure({
      params: ['context', 'snapshot'],
      guards: [
        {
          condition: 'snapshot.hasError',
          bind: { name: 'err', code: "'${snapshot.error}'" },
          value: call('Text', [identifier('err')]),
        },
        {
          condition: '!snapshot.hasData',
          bind: null,
          value: call('CircularProgressIndicator', [], { isConst: true }),
        },
      ],
      bind: { name: 'hasToken', code: 'snapshot.data!' },
      value: call('Text', [identifier('hasToken')]),
    });

    expect(printExpr(builder, { indent: 6, used: 15, trailing: 1 })).toBe(
      [
        '(context, snapshot) {',
        '        if (snapshot.hasError) {',
        "          final err = '${snapshot.error}';",
        '          return Text(err);',
        '        }',
        '        if (!snapshot.hasData) {',
        '          return const CircularProgressIndicator();',
        '        }',
        '        final hasToken = snapshot.data!;',
        '        return Text(hasToken);',
        '      }',
      ].join('\n'),
    );
  });

  test('an enclosing call is forced tall by the builder body', () => {
    const builder = builderClosure({
      params: ['context', 'snapshot'],
      guards: [],
      bind: null,
      value: call('Text', [stringLit('hi')]),
    });

    expect(
      printExpr(
        call('FutureBuilder<bool>', [], {
          named: [
            { name: 'future', value: identifier('_f') },
            { name: 'builder', value: builder },
          ],
        }),
        { indent: 4, used: 11, trailing: 1 },
      ),
    ).toBe(
      [
        'FutureBuilder<bool>(',
        '      future: _f,',
        '      builder: (context, snapshot) {',
        "        return Text('hi');",
        '      },',
        '    )',
      ].join('\n'),
    );
  });
});
