import {
  Animated,
  Card,
  Column,
  Divider,
  ElevatedButton,
  ListTile,
  Padding,
  Row,
  Text,
  useStore,
} from 'flutter-tsx';
import { launchUrl } from 'plugin:url_launcher';

import { SERVICES } from '../data/services';
import { ago, percent, rate } from '../helpers/format';
import { consoleStore } from '../stores/console';
import { StatusChip } from './StatusChip';

/** Everything about the service the sidebar has selected. */
export const ServiceDetail = () => {
  const [state, setState] = useStore(consoleStore);

  const refresh = () => {
    setState({ refreshes: state.refreshes + 1 });
  };

  return (
    <Padding padding={24}>
      <Column crossAxisAlignment="start">
        {SERVICES.filter((service) => service.id === state.selectedId).map(
          (service) => (
            <Column crossAxisAlignment="start">
              <Row>
                <Text>{service.name}</Text>
                <Padding padding={{ horizontal: 12 }}>
                  <StatusChip errorRate={service.errorRate} />
                </Padding>
              </Row>
              <Text>
                {service.region} · {rate(service.requestsPerMinute)} ·{' '}
                {percent(service.errorRate)} errors
              </Text>
              <Padding padding={{ vertical: 16 }}>
                <Row>
                  <ElevatedButton
                    onClick={async () => {
                      await launchUrl(service.dashboardUrl, {
                        mode: 'externalApplication',
                      });
                    }}
                  >
                    Open dashboard
                  </ElevatedButton>
                  <Padding padding={{ horizontal: 8 }}>
                    <ElevatedButton onClick={refresh}>Refresh</ElevatedButton>
                  </Padding>
                </Row>
              </Padding>
              <Animated
                type="fade"
                visible={state.refreshes > 0}
                duration={250}
              >
                <Text>Refreshed {state.refreshes} times this session</Text>
              </Animated>
              <Divider height={24} />
              <Text>Recent deployments</Text>
              <Card>
                <Column>
                  {service.deployments.map((deployment) => (
                    <ListTile
                      title={<Text>{deployment.version}</Text>}
                      subtitle={<Text>by {deployment.author}</Text>}
                      trailing={<Text>{ago(deployment.minutesAgo)}</Text>}
                    />
                  ))}
                </Column>
              </Card>
            </Column>
          ),
        )}
      </Column>
    </Padding>
  );
};
