import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Newsreader_500Medium } from '@expo-google-fonts/newsreader/500Medium';
import { Newsreader_600SemiBold } from '@expo-google-fonts/newsreader/600SemiBold';
import { SessionProvider, useSession } from '@/state/session';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold,
    Newsreader_500Medium, Newsreader_600SemiBold,
  });
  // Never hold the app on the splash for fonts: after 3 s, carry on with
  // system fonts and let the brand fonts swap in when they arrive.
  const [fontTimeout, setFontTimeout] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontTimeout(true), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <RootNavigator ready={fontsLoaded || !!fontError || fontTimeout} />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/** Signed-out people only ever see (auth); signed-in people only ever see (app). */
function RootNavigator({ ready }: { ready: boolean }) {
  const { status } = useSession();
  const loading = !ready || status === 'loading';

  // Swap the system splash for our own as soon as we can draw, so the full
  // Eutility logo (not just the symbol) is what people see while it loads.
  useEffect(() => { SplashScreen.hideAsync().catch(() => {}); }, []);

  if (loading) return <BrandLoading />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={status === 'signedIn'}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={status !== 'signedIn'}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}

function BrandLoading() {
  return (
    <View style={s.loading} accessibilityLabel="Eutility is loading">
      <Image source={require('../../assets/eutility-logo.png')} style={s.logo} resizeMode="contain" />
      <ActivityIndicator color="#007BB8" />
    </View>
  );
}

const s = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28, backgroundColor: '#FFFFFF' },
  logo: { width: 220, height: 220 * (112 / 314) },
});
