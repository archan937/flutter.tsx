import { Chip, Text } from 'flutter-tsx';

import { health } from '../helpers/format';

/** The health of a service, as one word with a colour behind it. */
export const StatusChip = ({ errorRate }: { errorRate: number }) => (
  <Chip
    label={<Text>{health(errorRate)}</Text>}
    backgroundColor={errorRate > 0.05 ? '#fde2e1' : '#e3f2e6'}
  />
);
