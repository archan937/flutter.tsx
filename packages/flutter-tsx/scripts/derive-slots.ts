import { loadApiSnapshot } from '@src/api/load';
import { deriveSlots } from '@src/derive/slots';

const snapshot = await loadApiSnapshot();
const slots = deriveSlots(snapshot);

const document = {
  meta: { frameworkVersion: snapshot.meta.frameworkVersion },
  widgets: slots,
};
const outputUrl = new URL('../ref/derived/slots.json', import.meta.url);
await Bun.write(outputUrl, `${JSON.stringify(document, null, 2)}\n`);

process.stdout.write(
  `Wrote slot semantics for ${Object.keys(slots).length} widgets to ` +
    `${outputUrl.pathname} (Flutter ${snapshot.meta.frameworkVersion}).\n`,
);
