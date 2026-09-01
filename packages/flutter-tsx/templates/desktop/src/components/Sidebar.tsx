import {
  Column,
  Divider,
  Expanded,
  ListView,
  Padding,
  Text,
  TextField,
  useStore,
} from 'flutter-tsx';

import { SERVICES } from '../data/services';
import { consoleStore } from '../stores/console';
import { ServiceRow } from './ServiceRow';

/** The list on the left: type to filter, click to open. */
export const Sidebar = () => {
  const [state, setState] = useStore(consoleStore);

  const filter = (value: string) => {
    setState({ query: value });
  };

  return (
    <Column crossAxisAlignment="stretch">
      <Padding padding={12}>
        <TextField
          onChanged={filter}
          decoration={{ hintText: 'Filter services' }}
        />
      </Padding>
      <Divider height={1} />
      <Expanded>
        <ListView>
          {SERVICES.filter((service) => service.name.includes(state.query)).map(
            (service) => (
              <ServiceRow service={service} />
            ),
          )}
        </ListView>
      </Expanded>
      <Divider height={1} />
      <Padding padding={12}>
        <Text>{SERVICES.length} services</Text>
      </Padding>
    </Column>
  );
};
