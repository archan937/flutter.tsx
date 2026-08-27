import { TabItem, TabView, Text } from 'flutter-tsx';

export const HomeTab = () => <Text>Home</Text>;

export const ProfileTab = () => <Text>Profile</Text>;

export const Shell = () => (
  <TabView>
    <TabItem label="Home" icon="home">
      <HomeTab />
    </TabItem>
    <TabItem label="Profile" icon="person">
      <ProfileTab />
    </TabItem>
  </TabView>
);
