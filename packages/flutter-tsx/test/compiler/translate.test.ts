import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import { analyzeSource } from '@src/compiler/analyze';
import {
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

const translate = (source: string): string => {
  const { expression, sourceFile } = parseExpression(source);
  const context: TranslateContext = {
    sourceFile,
    stateNames: new Set(['count', 'label']),
    handlerNames: new Set(['tick']),
    privateMembers: true,
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

  test('an unsupported binary operator is a numbered error', () => {
    expect(() => translate('count & 1')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:23 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });

  test('unsupported expressions are a numbered error', () => {
    expect(() => translate('count.toString()')).toThrow(
      new Error(
        'TSX0305 probe.tsx:6:17 — this expression is not compiled yet ' +
          '(roadmap step 18).',
      ),
    );
  });
});
