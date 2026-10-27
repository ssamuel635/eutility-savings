import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function InvoiceLayout() {
  return (
    <Stack
      screenOptions={{
        // SDK 58 makes the iOS 26+ header see-through with content underneath; keep it solid.
        headerTransparent: false,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.blue,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Submit your bill' }} />
      <Stack.Screen name="preview" options={{ title: 'Check and send' }} />
      <Stack.Screen name="done" options={{ title: '', headerBackVisible: false, gestureEnabled: false }} />
    </Stack>
  );
}
