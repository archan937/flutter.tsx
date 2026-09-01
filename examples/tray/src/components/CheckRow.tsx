import { ListTile, Text } from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

import { latency } from '../helpers/format';
import type { Check } from '../models/check';

/** One watched endpoint; clicking it opens the endpoint in a browser. */
export const CheckRow = ({ check }: { check: Check }) => (
  <ListTile
    onClick={async () => {
      await launchUrl(check.url, { mode: 'externalApplication' });
    }}
    title={<Text>{check.label}</Text>}
    subtitle={<Text>{latency(check.lastMs)}</Text>}
    trailing={<Text>{check.ok ? 'ok' : 'failing'}</Text>}
  />
);
