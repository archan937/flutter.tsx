import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import { analyzeSource } from '@src/compiler/analyze';
import {
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

const translate = (source: string): string => {
  const { expression, sourceFile } = parseExpression(source);
  const context: TranslateContext = {
    sourceFile,
    stateNames: new Set(['count', 'label']),
    handlerNames: new Set(['tick']),
    widgetProps: new Set<string>(),
    localDartTypes: new Map<string, string>(),
    helperReturns: new Map<string, string>(),
    enumMembers: new Map<string, Map<string, string>>(),
    privateMembers: true,
    memberReads: memberReads(),
    classFields: new Map(),
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

  test('an unsupported property access is a numbered error', () => {
    expect(() => translate('label.size')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:17 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('an unsupported binary operator is a numbered error', () => {
    expect(() => translate('count & 1')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:23 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('unsupported expressions are a numbered error', () => {
    // `slice` is deliberately unmapped: Dart's sublist/substring differ in
    // how they clamp, so it raises rather than compiling to something else.
    expect(() => translate('count.slice(0)')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:17 — this expression is not compiled yet ' +
          '(roadmap step 18).',
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

  test('a property without a zero value is a numbered error', () => {
    expect(() => translate('info.stamp')).toThrow(
      new Error(
        'TSX0316 probe.tsx:6:22 — reading `stamp` needs a DateTime ' +
          'fallback, which is not compiled yet. Read it inside a handler ' +
          'and store the result in state.',
      ),
    );
  });
});
