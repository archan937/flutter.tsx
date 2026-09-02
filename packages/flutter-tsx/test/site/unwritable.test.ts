import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { loadSiteSections } from '@src/site/sections';

/**
 * The boundary of what TSX can write, stated rather than implied.
 *
 * Every widget the reference documents either shows an example that really
 * compiles — the analyze sweep proves that — or names the values it could
 * not write and why. There is no third state: no placeholder without a
 * reason, and no widget quietly left out.
 *
 * The two reasons are answered very differently. A value Flutter supplies is
 * a boundary of the framework: nothing in the SDK builds one, so nothing in
 * TSX could either. A shape not yet expressible is work, and the list of it
 * is committed here so it can only shrink — adding to it fails.
 */
const snapshot = await loadApiSnapshot();
const page = buildSitePage(
  snapshot,
  deriveSlots(snapshot),
  await loadSiteSections(),
);

/** Widgets whose examples wait on a shape the compiler does not write yet. */
const NOT_YET_EXPRESSIBLE: readonly string[] = ['ShaderMask'];

/** Widgets a hook writes: `useAsync` and `useStream` generate these. */
const WRITTEN_BY_A_HOOK: readonly string[] = ['FutureBuilder', 'StreamBuilder'];

describe('the boundary of what TSX writes', () => {
  test('every placeholder says why it is one', () => {
    const unexplained = page.widgets
      .filter((widget) => !widget.example.complete)
      .filter((widget) => widget.example.unwritable.length === 0)
      .map((widget) => widget.name);

    expect(unexplained).toEqual([]);
  });

  test('nothing new is left unwritten', () => {
    const waiting = [
      ...new Set(
        page.widgets
          .filter((widget) =>
            widget.example.unwritable.some(
              (entry) => entry.reason === 'not-yet-expressible',
            ),
          )
          .map((widget) => widget.name),
      ),
    ].sort();

    // Shrinking this list is the work; growing it is a regression.
    expect(waiting).toEqual([...NOT_YET_EXPRESSIBLE]);
  });

  test('the widgets a hook writes are named as such', () => {
    // `useAsync` and `useStream` generate these builders; a developer never
    // hands them a Future or a Stream by hand.
    const byHook = [
      ...new Set(
        page.widgets
          .filter((widget) =>
            widget.example.unwritable.some(
              (entry) => entry.reason === 'written-by-a-hook',
            ),
          )
          .map((widget) => widget.name),
      ),
    ].sort();

    expect(byHook).toEqual([...WRITTEN_BY_A_HOOK]);
  });

  test('a value Flutter supplies is never claimed to be writable', () => {
    // Nothing in the SDK builds one of these, so the reference says so
    // rather than showing a value that could not exist.
    const supplied = page.widgets.flatMap((widget) =>
      widget.example.unwritable
        .filter((entry) => entry.reason === 'supplied-by-flutter')
        .map((entry) => `${widget.name}.${entry.prop}`),
    );

    expect(supplied.length).toBeGreaterThan(0);
    expect(supplied.filter((name) => name.split('.').length !== 2)).toEqual([]);
  });
});
