import {
  AppBar,
  Column,
  Expanded,
  Row,
  Scaffold,
  SizedBox,
  Text,
  VerticalDivider,
} from 'flutter-tsx';

import { AboutBar } from './components/AboutBar';
import { ServiceDetail } from './components/ServiceDetail';
import { Sidebar } from './components/Sidebar';

/**
 * A desktop window: a list on the left, the selected thing on the right.
 *
 * The two panes share one store, so selecting in the sidebar re-renders the
 * detail pane and nothing has to be passed between them.
 */
export const App = () => (
  <Scaffold appBar={<AppBar title={<Text>Service console</Text>} />}>
    <Column>
      <Expanded>
        <Row crossAxisAlignment="stretch">
          <SizedBox width={280}>
            <Sidebar />
          </SizedBox>
          <VerticalDivider width={1} />
          <Expanded>
            <ServiceDetail />
          </Expanded>
        </Row>
      </Expanded>
      <AboutBar />
    </Column>
  </Scaffold>
);
