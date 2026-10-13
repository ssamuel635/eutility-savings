import { Stack } from 'expo-router';
import { colors, fonts } from '@/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.canvas },
        headerTintColor: colors.blue,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
        headerBackButtonDisplayMode: 'minimal',
        title: '',
        contentStyle: { backgroundColor: colors.canvas },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
