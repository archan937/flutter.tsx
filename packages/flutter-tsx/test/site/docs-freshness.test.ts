import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { buildApiReferenceHtml } from '@src/site/render';

describe('committed docs/api-reference.html', () => {
  test('is byte-identical to a fresh render of the current snapshot', async () => {
    const snapshot = await loadApiSnapshot();
    const fresh = buildApiReferenceHtml(
      buildSitePage(snapshot, deriveSlots(snapshot)),
    );

    const committed = await Bun.file(
      new URL('../../../../docs/api-reference.html', import.meta.url),
    ).text();
    expect(committed).toBe(fresh);
  }, 60000);
});
