import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.blue,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="invoice" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="notifications" options={{ title: 'Updates' }} />
      <Stack.Screen name="profile-edit" options={{ title: 'Edit details' }} />
    </Stack>
  );
}
