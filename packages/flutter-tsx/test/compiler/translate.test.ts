import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import { analyzeSource } from '@src/compiler/analyze';
import {
  type HelperSignature,
  type MemberReadInfo,
  type TranslateContext,
  translateExpression,
} from '@src/compiler/translate';

const parseExpression = (
  source: string,
): { expression: ts.Expression; sourceFile: ts.SourceFile } => {
  const analysis = analyzeSource(
    "import { Text, useState } from 'flutter-tsx';\n" +
      'export const Probe = () => {\n' +
      '  const [count, setCount] = useState(0);\n' +
      "  const [label, setLabel] = useState('x');\n" +
      '  const tick = () => {};\n' +
      `  const probe = ${source};\n` +
      '  return <Text>hi</Text>;\n' +
      '};\n',
    'probe.tsx',
  );
  const { sourceFile } = analysis;
  let found: ts.Expression | undefined;
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText() === 'probe' &&
      node.initializer !== undefined
    ) {
      found = node.initializer;
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (found === undefined) {
    throw new Error('probe expression not found');
  }
  return { expression: found, sourceFile };
};

const memberReads = (): Map<string, MemberReadInfo> =>
  new Map([
    [
      'info',
      {
        className: 'PackageInfo',
        receiver: '_info',
        nullable: true,
        fields: new Map([
          ['appName', { kind: 'scalar' as const, name: 'String' as const }],
          ['buildCount', { kind: 'scalar' as const, name: 'int' as const }],
          ['ratio', { kind: 'scalar' as const, name: 'double' as const }],
          ['debug', { kind: 'scalar' as const, name: 'bool' as const }],
          ['stamp', { kind: 'named' as const, name: 'DateTime' }],
        ]),
      },
    ],
    [
      'storage',
      {
        className: 'FlutterSecureStorage',
        receiver: '_storage',
        nullable: false,
        fields: new Map([
          ['label', { kind: 'scalar' as const, name: 'String' as const }],
        ]),
      },
    ],
  ]);

const translate = (
  source: string,
  useDartImport: (uri: string, prefix?: string) => void = (): void => undefined,
): string => {
  const { expression, sourceFile } = parseExpression(source);
  const context: TranslateContext = {
    sourceFile,
    stateNames: new Set(['count', 'label']),
    pluginValueCall: (): null => null,
    sdkStaticCall: (): null => null,
    renames: new Map<string, string>(),
    handlerNames: new Set(['tick']),
    widgetProps: new Set<string>(),
    localDartTypes: new Map<string, string>(),
    helperReturns: new Map<string, HelperSignature>(),
    privateHelpers: new Set<string>(),
    enumMembers: new Map<string, Map<string, string>>(),
    privateMembers: true,
    memberReads: memberReads(),
    classFields: new Map(),
    jsonModels: new Set(),
    nullableHandles: new Map(),
    narrowed: new Set<string>(),
    controllerNames: new Set<string>(),
    pluginConstructibles: new Map([['MediaType', []]]),
    pluginConstructors: new Map([['MediaType', []]]),
    useDartImport,
  };
  return translateExpression(expression, context);
};

describe('translateExpression', () => {
  test('literals', () => {
    expect(translate('42')).toBe('42');
    expect(translate('1.5')).toBe('1.5');
    expect(translate('true')).toBe('true');
    expect(translate('false')).toBe('false');
    expect(translate("'hi'")).toBe("'hi'");
    expect(translate('"it\'s $5"')).toBe("'it\\'s \\$5'");
  });

  test('identifiers rename state and handlers to private members', () => {
    expect(translate('count')).toBe('_count');
    expect(translate('tick')).toBe('_tick');
    expect(translate('other')).toBe('other');
  });

  test('binary and unary operators, strict equality mapped', () => {
    expect(translate('count + 1')).toBe('_count + 1');
    expect(translate('count === 3')).toBe('_count == 3');
    expect(translate('count !== 3')).toBe('_count != 3');
    expect(translate('!true')).toBe('!true');
    expect(translate('-count')).toBe('-_count');
    expect(translate('(count + 1) * 2')).toBe('(_count + 1) * 2');
  });

  test('template literals become Dart interpolation', () => {
    expect(translate('`Count: ${count}`')).toBe("'Count: $_count'");
    expect(translate('`Sum: ${count + 1}!`')).toBe("'Sum: ${_count + 1}!'");
    expect(translate('`plain`')).toBe("'plain'");
  });

  // `'$counts'` reads as the name `counts`, which is a different thing —
  // Dart needs the braces as soon as a name could keep going.
  test('a name followed by more of a name keeps its braces', () => {
    expect(translate('`${count}s`')).toBe("'${_count}s'");
    expect(translate('`${count}_1`')).toBe("'${_count}_1'");
    expect(translate('`${count}9`')).toBe("'${_count}9'");
    expect(translate('`${count} s`')).toBe("'$_count s'");
    expect(translate('`${count}.`')).toBe("'$_count.'");
  });

  // Dart puts rounding on the number itself and the rest in `dart:math`.
  test('Math becomes the Dart the same arithmetic is written with', () => {
    expect(translate('Math.floor(count / 2)')).toBe('(_count / 2).floor()');
    expect(translate('Math.ceil(count)')).toBe('_count.ceil()');
    expect(translate('Math.round(count)')).toBe('_count.round()');
    expect(translate('Math.abs(count)')).toBe('_count.abs()');
    expect(translate('Math.trunc(count)')).toBe('_count.truncate()');
    expect(translate('Math.max(count, 2)')).toBe('math.max(_count, 2)');
    expect(translate('Math.min(count, 2)')).toBe('math.min(_count, 2)');
    expect(translate('Math.sqrt(count)')).toBe('math.sqrt(_count)');
    expect(translate('Math.pow(count, 2)')).toBe('math.pow(_count, 2)');
    expect(translate('Math.PI')).toBe('math.pi');
  });

  test('a Math call that needs dart:math records the prefixed import', () => {
    const imports: { uri: string; prefix?: string }[] = [];
    translate('Math.sqrt(count)', (uri, prefix) => {
      imports.push(prefix === undefined ? { uri } : { uri, prefix });
    });

    expect(imports).toEqual([{ uri: 'dart:math', prefix: 'math' }]);
  });

  test('rounding needs no import: Dart puts it on the number', () => {
    const imports: string[] = [];
    translate('Math.round(count)', (uri) => {
      imports.push(uri);
    });

    expect(imports).toEqual([]);
  });

  test('conditional and null-coalescing expressions translate', () => {
    expect(translate('count > 0 ? count : 0')).toBe('_count > 0 ? _count : 0');
    expect(translate('count ?? 1')).toBe('_count ?? 1');
  });

  test('array literals and spreads translate to Dart collections', () => {
    expect(translate("['a', 'b']")).toBe("['a', 'b']");
    expect(translate("[...label, 'x']")).toBe("[..._label, 'x']");
    expect(translate('[]')).toBe('[]');
  });

  test('.length property access translates with renamed targets', () => {
    expect(translate('label.length')).toBe('_label.length');
    expect(translate('label.length + 1')).toBe('_label.length + 1');
  });

  test('a parenthesised expression keeps its parentheses', () => {
    // Precedence is the author's, not the compiler's to rearrange.
    expect(translate('(count + 1) * 2')).toBe('(_count + 1) * 2');
  });

  test('an unsupported property access is a numbered error', () => {
    expect(() => translate('label.size')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:17 — `label.size` reads a member the compiler ' +
          'cannot resolve to a Dart one.',
      ),
    );
  });

  test('an unsupported binary operator is a numbered error', () => {
    expect(() => translate('count & 1')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:23 — `&` is an expression form the compiler ' +
          'does not translate to Dart.',
      ),
    );
  });

  test('unsupported expressions are a numbered error', () => {
    expect(() => translate('count as unknown as string')).toThrow(
      /TSX0305 .* is an expression form the compiler does not translate/,
    );
  });

  // `slice` is deliberately unmapped: Dart's sublist and substring differ in
  // how they clamp, so it names the way that does work rather than compiling
  // to something that behaves differently.
  test('a method with no faithful Dart counterpart names the alternative', () => {
    expect(() => translate('count.slice(0)')).toThrow(
      new Error(
        'TSX0341 probe.tsx:6:23 — `slice` has no Dart counterpart that ' +
          'behaves the same way — use `substring(start, end)`, with indices ' +
          'inside the value.',
      ),
    );
  });
});
describe('translateExpression — plugin property reads', () => {
  test('a non-null handle reads the property directly', () => {
    expect(translate('storage.label')).toBe('_storage.label');
  });

  test('a nullable handle reads with the zero-value fallback', () => {
    expect(translate('info.appName')).toBe("_info?.appName ?? ''");
    expect(translate('info.buildCount')).toBe('_info?.buildCount ?? 0');
    expect(translate('info.ratio')).toBe('_info?.ratio ?? 0');
    expect(translate('info.debug')).toBe('_info?.debug ?? false');
  });

  test('an unknown property is a numbered error', () => {
    expect(() => translate('info.appNam')).toThrow(
      new Error(
        'TSX0315 probe.tsx:6:22 — `PackageInfo` has no property ' +
          '`appNam`. Check the API reference for the available properties.',
      ),
    );
  });

  test('a property that needs a guard says so, and how', () => {
    expect(() => translate('info.stamp')).toThrow(
      new Error(
        'TSX0316 probe.tsx:6:22 — reading `stamp` on a value that may be ' +
          'null needs a guard: `if (!info) return …;` above it, or `?.` ' +
          'with a DateTime fallback of your own.',
      ),
    );
  });
});
