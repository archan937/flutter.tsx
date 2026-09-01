import { TabItem, TabView } from 'flutter-tsx';

import { CaptureTab } from './tabs/CaptureTab';
import { NotesTab } from './tabs/NotesTab';
import { VaultTab } from './tabs/VaultTab';

/**
 * A phone app with three tabs.
 *
 * `<TabView>` becomes a Scaffold with a navigation bar and an IndexedStack,
 * so every tab keeps its state while the bar switches between them.
 */
export const App = () => (
  <TabView>
    <TabItem label="Notes" icon="notes">
      <NotesTab />
    </TabItem>
    <TabItem label="Capture" icon="photo_camera">
      <CaptureTab />
    </TabItem>
    <TabItem label="Vault" icon="lock">
      <VaultTab />
    </TabItem>
  </TabView>
);
