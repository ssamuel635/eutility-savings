// Welcome — first screen for anyone not signed in.

import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Logo, Screen, Text } from '@/components';
import { colors, space } from '@/theme';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'calculator-outline', text: 'Compare every plan from Singapore’s retailers' },
  { icon: 'camera-outline', text: 'Snap your bill — we handle the switch' },
  { icon: 'git-commit-outline', text: 'Track every step until your new plan starts' },
  { icon: 'gift-outline', text: 'Earn rewards when friends switch too' },
];

export default function Welcome() {
  return (
    <Screen
      edges={['top', 'bottom']}
      footer={
        <>
          <Button label="Continue with phone number" icon="phone-portrait-outline" onPress={() => router.push('/phone')} />
          <Button label="Sign in with email" variant="ghost" onPress={() => router.push('/email')} />
        </>
      }
    >
      <View style={s.logo}><Logo height={44} /></View>
      <View style={{ gap: space.md }}>
        <Text variant="eyebrow">Independent energy experts since 1979</Text>
        <Text variant="display">Get control of your electricity bill.</Text>
        <Text variant="body">We check, you decide, we handle the rest.</Text>
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
  logo: { paddingTop: space.lg, paddingBottom: space.sm },
  point: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
});
