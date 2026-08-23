import { describe, expect, test } from 'bun:test';

import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { formatTs } from '@src/generate/format';
import { buildSitePage } from '@src/site/from-snapshot';
import { emitExampleProbe } from '@src/site/probe';
import { buildApiReferenceHtml } from '@src/site/render';

describe('committed generated docs', () => {
  test('docs/api-reference.html and the example probe are byte-identical to a fresh render', async () => {
    const snapshot = await loadApiSnapshot();
    const page = buildSitePage(snapshot, deriveSlots(snapshot));

    const committedHtml = await Bun.file(
      new URL('../../../../docs/api-reference.html', import.meta.url),
    ).text();
    expect(committedHtml).toBe(buildApiReferenceHtml(page));

    const committedProbe = await Bun.file(
      new URL('__generated__/examples.typecheck.tsx', import.meta.url),
    ).text();
    expect(committedProbe).toBe(await formatTs(emitExampleProbe(page)));
  }, 60000);
});
