import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { serializeApiSnapshot } from '@src/api/serialize';
import { FLUTTER_VERSION } from '@src/sdk/version';

describe('loadApiSnapshot against the committed ref/api.json', () => {
  test('loads, fully validates, and losslessly roundtrips the snapshot', async () => {
    const snapshot = await loadApiSnapshot();

    expect(snapshot.meta).toEqual({
      frameworkVersion: FLUTTER_VERSION,
      dartSdkVersion: '3.13.1',
      frameworkRevision: '6655482ec06e547f90abf8ae7590466f4415978d',
    });
    expect(snapshot.entities).toHaveLength(1547);
    expect(snapshot.hierarchy.PreferredSizeWidget).toEqual([
      'Widget',
      'DiagnosticableTree',
      'Diagnosticable',
    ]);

    const rawDocument = await Bun.file(
      new URL('../../ref/api.json', import.meta.url),
    ).text();
    expect(serializeApiSnapshot(snapshot)).toBe(rawDocument);
  });

  test('rejects a missing snapshot file with a precise error', () => {
    expect(loadApiSnapshot('/nowhere/api.json')).rejects.toThrow(
      new Error(
        'api.json: /nowhere/api.json does not exist — run `bun run extract` ' +
          'first.',
      ),
    );
  });
});
