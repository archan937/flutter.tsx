import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { loadSiteSections } from '@src/site/sections';

/**
 * The boundary of what TSX can write — which is now the whole surface.
 *
 * Every widget the reference documents shows an example that really
 * compiles: the analyze sweep proves each one against `flutter analyze`,
 * and this says there are no exceptions left. A value nothing builds is
 * handed over by a static, answered by another value, or written outright
 * with `defineDelegate`; a Future or a Stream is answered by whatever the
 * SDK answers with one.
 *
 * This is a ratchet in its strictest form: a widget whose example cannot be
 * written fails here, by name and with the reason. Flutter adding a shape
 * TSX has no answer for is a red test, never a quiet placeholder.
 */
const snapshot = await loadApiSnapshot();
const page = buildSitePage(
  snapshot,
  deriveSlots(snapshot),
  await loadSiteSections(),
);

describe('the boundary of what TSX writes', () => {
  test('every widget example is complete', () => {
    const incomplete = page.widgets
      .filter((widget) => !widget.example.complete)
      .map((widget) => widget.name);

    expect(incomplete).toEqual([]);
    expect(page.incompleteExamples).toEqual([]);
  });

  test('no prop of any widget is left unwritten, for any reason', () => {
    const unwritten = page.widgets.flatMap((widget) =>
      widget.example.unwritable.map(
        (entry) => `${widget.name}.${entry.prop}: ${entry.reason}`,
      ),
    );

    expect(unwritten).toEqual([]);
  });

  test('every widget really has an example to show', () => {
    // A complete example is not an empty one: each names its own tag.
    const missing = page.widgets.filter(
      (widget) => !widget.example.tsx.includes(`<${widget.name}`),
    );

    expect(missing.map((widget) => widget.name)).toEqual([]);
    expect(page.widgets.length).toBeGreaterThan(500);
  });
});
