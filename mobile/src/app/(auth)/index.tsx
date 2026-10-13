// Welcome — first screen for anyone not signed in. Mirrors the website's
// homepage hero: a photo fading into white, the logo, and the price story.

import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Logo, Screen, Text } from '@/components';
import { FadedPhoto } from '@/components/Photo';
import { MARKET_PLANS, TARIFF, TARIFF_PERIOD } from '@/engine';
import { colors, fonts, radius, space } from '@/theme';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'flash-outline', text: 'Compare every plan from Singapore’s retailers' },
  { icon: 'camera-outline', text: 'Snap your bill — we handle the switch' },
  { icon: 'swap-horizontal-outline', text: 'Track every step until your new plan starts' },
  { icon: 'gift-outline', text: 'Earn rewards when friends switch too' },
];

// Same figure as the website hero: the lowest fixed rate on sale (no daily charge).
const LOWEST_FIXED = Math.min(...MARKET_PLANS.filter((p) => p.pricingType === 'fixed' && !p.dailyCharge).map((p) => p.rate ?? Infinity));

export default function Welcome() {
  const insets = useSafeAreaInsets();
  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Button label="Continue with phone number" icon="phone-portrait-outline" onPress={() => router.push('/phone')} />
          <Button label="Sign in with email" variant="ghost" onPress={() => router.push('/email')} />
        </>
      }
    >
      <FadedPhoto name="sofa" ratio={4 / 3} focus="top" style={s.hero}>
        <View style={[s.logoPlate, { top: insets.top + space.md }]}><Logo height={34} /></View>
      </FadedPhoto>

      <View style={{ gap: space.md, marginTop: -space.x3 }}>
        <Text variant="eyebrow" color={colors.blue}>Independent energy experts since 1979</Text>
        <Text variant="display">Get control of your electricity bill.</Text>
      </View>

      <View style={s.rates} accessibilityLabel={`Fixed plans from ${LOWEST_FIXED.toFixed(2)} cents per kilowatt hour, against SP Group’s tariff of ${TARIFF.toFixed(2)}`}>
        <View>
          <Text style={s.rate}>{LOWEST_FIXED.toFixed(2)}<Text style={s.unit}>¢/kWh</Text></Text>
          <Text variant="caption">Fixed plans from</Text>
        </View>
        <Text variant="bodyStrong" color={colors.inkMuted} style={{ paddingBottom: 20 }}>vs</Text>
        <View>
          <Text style={[s.rate, s.tariff]}>{TARIFF.toFixed(2)}<Text style={s.unit}>¢/kWh</Text></Text>
          <Text variant="caption">SP Group tariff, {TARIFF_PERIOD}</Text>
        </View>
      </View>

      <View style={{ gap: space.lg }}>
        {POINTS.map((p) => (
          <View key={p.text} style={s.point}>
            <Ionicons name={p.icon} size={22} color={colors.blue} />
            <Text variant="body" style={{ flex: 1 }}>{p.text}</Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  // Full-bleed: the photo runs edge to edge and under the status bar.
  hero: { marginTop: -space.xl, marginHorizontal: -space.xl },
  logoPlate: { position: 'absolute', left: space.xl, backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  rates: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  rate: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 34, color: colors.blue, letterSpacing: -0.8 },
  tariff: { fontSize: 22, lineHeight: 28, color: colors.inkMuted },
  unit: { fontFamily: fonts.bold, fontSize: 13, letterSpacing: 0 },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
});
