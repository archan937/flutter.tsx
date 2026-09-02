import { describe, expect, test } from 'bun:test';
import ts from 'typescript';

import { transpileComponent } from '@src/compiler/transpile';
import { listFixtures } from '@test/support/golden';

/**
 * The no-dead-input gate.
 *
 * A `finally` clause was once dropped on the floor: the lowering read some of
 * a `try` statement's children and nothing looked at the rest, so the
 * compiler emitted Dart that silently did less than the TSX said. Catching
 * that by reading the compiler is exactly the assurance this project refuses
 * to rely on, so it is caught mechanically instead.
 *
 * Every removable piece of every fixture is removed in turn and the fixture
 * recompiled. The compiler must react — a different program, or a numbered
 * error. Output that does not change is input the compiler ignored, which is
 * either a silent drop or a limitation it should have refused out loud.
 */
/**
 * A piece of a source, and the edits that prove the compiler reads it.
 *
 * Deleting is the first edit and usually the telling one, but a value that
 * happens to equal the default it stands for compiles the same whether it is
 * there or not. Such a piece is still read, and rewriting the value proves
 * it — so a piece counts as read when any of its edits changes the output.
 */
interface Probe {
  label: string;
  edits: { start: number; end: number; replacement: string }[];
}

const FINALLY_KEYWORD = 'finally';
const ELSE_KEYWORD = 'else';
const COMMA = ',';
// No enum member, no widget and no state is named this, so a value rewritten
// to it must change the Dart — or be refused.
const OTHER_TEXT = "'a value nothing in Flutter is named'";
const OTHER_NUMBER = '424242';

/** The value an edit writes in place of a literal, to prove it is read. */
const rewritten = (literal: ts.Node): string | null => {
  if (
    ts.isStringLiteral(literal) ||
    ts.isNoSubstitutionTemplateLiteral(literal)
  ) {
    return OTHER_TEXT;
  }
  if (ts.isNumericLiteral(literal)) {
    return OTHER_NUMBER;
  }
  if (literal.kind === ts.SyntaxKind.TrueKeyword) {
    return 'false';
  }
  return literal.kind === ts.SyntaxKind.FalseKeyword ? 'true' : null;
};

/** The pieces of a source the compiler must react to. */
const probes = (sourceFile: ts.SourceFile): Probe[] => {
  const found: Probe[] = [];
  const text = sourceFile.getFullText();

  /** Rewriting each literal the piece contains, deepest first. */
  const valueEdits = (node: ts.Node): Probe['edits'] => {
    const edits: Probe['edits'] = [];
    const walk = (inner: ts.Node): void => {
      const replacement = rewritten(inner);
      if (replacement !== null) {
        edits.push({
          start: inner.getStart(sourceFile),
          end: inner.end,
          replacement,
        });
      }
      ts.forEachChild(inner, walk);
    };
    walk(node);
    return edits;
  };

  const add = (node: ts.Node, start = node.getStart(sourceFile)): void => {
    found.push({
      label: text.slice(start, node.end).trim().split('\n')[0] ?? '',
      edits: [{ start, end: node.end, replacement: '' }, ...valueEdits(node)],
    });
  };

  // An item of a comma-separated list takes its separator with it, so what is
  // left is a shorter list rather than a syntax error the compiler could
  // react to for the wrong reason.
  const addListItem = (
    item: ts.Node,
    siblings: ts.NodeArray<ts.Node>,
  ): void => {
    const index = siblings.indexOf(item);
    const next = siblings[index + 1];
    const previous = siblings[index - 1];
    const start =
      next === undefined && previous !== undefined
        ? text.lastIndexOf(COMMA, item.getStart(sourceFile))
        : item.getStart(sourceFile);
    const end =
      next === undefined
        ? item.end
        : text.indexOf(COMMA, item.end) + COMMA.length;
    found.push({
      label: text.slice(start, end).trim().split('\n')[0] ?? '',
      edits: [{ start, end, replacement: '' }, ...valueEdits(item)],
    });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node)) {
      // A `finally` is the keyword and its block together; the block alone is
      // not something a source can be missing.
      const { finallyBlock } = node;
      if (finallyBlock !== undefined) {
        add(
          finallyBlock,
          text.lastIndexOf(FINALLY_KEYWORD, finallyBlock.getStart(sourceFile)),
        );
      }
      if (node.catchClause !== undefined) {
        add(node.catchClause);
      }
    }
    if (
      ts.isJsxAttribute(node) ||
      (ts.isStatement(node) && ts.isBlock(node.parent))
    ) {
      add(node);
    }
    // `} else { … }` is the keyword and what follows it: an `else if` chain
    // is removed from the `else` that introduces it.
    if (ts.isIfStatement(node) && node.elseStatement !== undefined) {
      add(
        node.elseStatement,
        text.lastIndexOf(ELSE_KEYWORD, node.elseStatement.getStart(sourceFile)),
      );
    }
    // An argument that changes nothing was never read — the shape a dropped
    // hook option or a dropped callback parameter takes.
    const args = ts.isCallExpression(node)
      ? node.arguments
      : ts.isNewExpression(node)
        ? node.arguments
        : undefined;
    if (args !== undefined) {
      for (const argument of args) {
        addListItem(argument, args);
      }
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const property of node.properties) {
        addListItem(property, node.properties);
      }
    }
    if (
      (ts.isJsxElement(node) ||
        ts.isJsxSelfClosingElement(node) ||
        ts.isJsxExpression(node)) &&
      ts.isJsxElement(node.parent)
    ) {
      add(node);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  return found;
};

/** What the compiler ignored in a source, which must be nothing. */
const ignoredParts = async (
  filePath: string,
  source: string,
): Promise<string[]> => {
  const baseline = await transpileComponent({ source, filePath });
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.TSX,
  );

  const ignored: string[] = [];
  for (const probe of probes(sourceFile)) {
    let read = false;
    for (const edit of probe.edits) {
      const mutant =
        source.slice(0, edit.start) + edit.replacement + source.slice(edit.end);
      const compiled = await transpileComponent({
        source: mutant,
        filePath,
      }).catch((): null => null);
      if (compiled !== baseline) {
        read = true;
        break;
      }
    }
    if (!read) {
      ignored.push(probe.label);
    }
  }
  return ignored;
};

const fixtures = await listFixtures();

const templateSources = (
  await Array.fromAsync(new Bun.Glob('templates/*/src/**/*.tsx').scan('.'))
).sort();

describe('every part of a source reaches the output', () => {
  for (const fixture of fixtures) {
    test(`${fixture.id} compiles nothing it was not given`, async () => {
      expect(
        await ignoredParts(
          fixture.inputPath,
          await Bun.file(fixture.inputPath).text(),
        ),
      ).toEqual([]);
    });
  }

  // The templates are the apps a newcomer starts from, and they exercise far
  // more of the compiler than any one fixture does.
  for (const path of templateSources) {
    test(`${path} compiles nothing it was not given`, async () => {
      expect(await ignoredParts(path, await Bun.file(path).text())).toEqual([]);
    });
  }
});
