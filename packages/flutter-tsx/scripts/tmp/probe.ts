import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';
import { buildSitePage } from '@src/site/from-snapshot';
import { loadSiteSections } from '@src/site/sections';

const snapshot = await loadApiSnapshot();
const page = buildSitePage(
  snapshot,
  deriveSlots(snapshot),
  await loadSiteSections(),
);
for (const widget of page.widgets) {
  for (const entry of widget.example.unwritable) {
    if (entry.reason !== 'not-yet-expressible') continue;
    console.log(`${widget.name}.${entry.prop}  ::  ${entry.type}`);
  }
}
