import { ListTile, Text, useStore } from 'flutter-tsx';

import { rate } from '../helpers/format';
import type { Service } from '../models/service';
import { consoleStore } from '../stores/console';
import { StatusChip } from './StatusChip';

/** One service in the sidebar list; selecting it opens it on the right. */
export const ServiceRow = ({ service }: { service: Service }) => {
  const [state, setState] = useStore(consoleStore);

  const select = () => {
    setState({ selectedId: service.id });
  };

  return (
    <ListTile
      onClick={select}
      selected={state.selectedId === service.id}
      title={<Text>{service.name}</Text>}
      subtitle={<Text>{rate(service.requestsPerMinute)}</Text>}
      trailing={<StatusChip errorRate={service.errorRate} />}
    />
  );
};
