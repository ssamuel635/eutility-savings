import { Tabs } from 'expo-router';
import { TabBar, TAB_ITEMS } from '@/components/TabBar';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {Object.entries(TAB_ITEMS).map(([name, item]) => (
        <Tabs.Screen key={name} name={name} options={{ title: item.label }} />
      ))}
    </Tabs>
  );
}
