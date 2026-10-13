// "Homes like yours", as on the website: a photo per type of home and a real
// estimate from the price sheet (no made-up testimonials).

import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { compare, CONFIG, RATES_DATE } from '@/engine';
import { money } from '@/lib/format';
import { colors, fonts, radius, space } from '@/theme';
import { FadedPhoto, type PhotoKey } from './Photo';
import { Text } from './Text';

const HOMES: { label: string; name: string; sentence: string; photo: PhotoKey }[] = [
  { label: 'HDB 3-room', name: '3-room HDB flat', sentence: 'A 3-room HDB flat', photo: 'voidDeck' },
  { label: 'HDB 4-room', name: '4-room HDB flat', sentence: 'A 4-room HDB flat', photo: 'dinner' },
  { label: 'HDB 5-room', name: '5-room HDB flat', sentence: 'A 5-room HDB flat', photo: 'hdb' },
  { label: 'Condo', name: 'Condo', sentence: 'A condo', photo: 'neighbours' },
  { label: 'Landed', name: 'Landed home', sentence: 'A landed home', photo: 'kites' },
];

export function HomeStories() {
  const stories = useMemo(() => HOMES.map((h) => {
    const kwh = CONFIG.homePresets.find((p) => p.label === h.label)?.kwh;
    if (!kwh) return null;
    const r = compare({ kwh, contract: '24' });
    return r.best && !r.alreadyBest ? { ...h, kwh, best: r.best } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x), []);

  return (
    <View style={{ gap: space.md }}>
      <View style={{ gap: 4 }}>
        <Text variant="h2">Homes like yours</Text>
        <Text variant="small">What switching could look like, on today’s rates.</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.row} decelerationRate="fast" snapToInterval={CARD + space.md}>
        {stories.map((st) => (
          <Pressable
            key={st.label}
            accessibilityRole="button"
            accessibilityLabel={`${st.name}: could save ${money(st.best.savingYearly)} a year. Check your own home.`}
            onPress={() => router.navigate({ pathname: '/savings', params: { kwh: String(st.kwh) } })}
            style={({ pressed }) => [s.card, pressed && { borderColor: colors.blue }]}
          >
            <FadedPhoto name={st.photo} ratio={3 / 2}>
              <Text style={s.home}>{st.name}</Text>
            </FadedPhoto>
            <View style={s.body}>
              <Text style={s.save}>{money(st.best.savingYearly)}<Text style={s.saveUnit}> a year</Text></Text>
              <Text variant="small">{st.sentence} using about {st.kwh} kWh a month, moving from SP Group’s tariff to {st.best.plan.retailer} {st.best.plan.name}.</Text>
              <Text variant="caption">Example estimate, rates as at {RATES_DATE}.</Text>
              <Text variant="bodyStrong" color={colors.blue} style={{ fontSize: 14 }}>Check your own home →</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const CARD = 264;
const s = StyleSheet.create({
  // Bleed to the screen edges so cards scroll past the padding.
  row: { gap: space.md, paddingHorizontal: space.xl, marginHorizontal: -space.xl },
  card: { width: CARD, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, overflow: 'hidden' },
  home: { position: 'absolute', left: 14, bottom: 10, fontFamily: fonts.bold, fontSize: 15, color: colors.ink },
  body: { padding: space.lg, paddingTop: space.xs, gap: 6 },
  save: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 32, color: colors.orangeDisplay, letterSpacing: -0.5 },
  saveUnit: { fontFamily: fonts.bold, fontSize: 14, color: colors.orangeAA, letterSpacing: 0 },
});
