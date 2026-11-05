// The referral lucky draw on Home: a navy card that says how it works and,
// when there are any, how many draws are waiting.

import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { prizeMax } from '@/engine';
import { sgd } from '@/lib/rewards';
import { colors, elevate, fonts, radius, space } from '@/theme';
import { Text } from './Text';

export function RewardPromo({ waiting, onPress }: { waiting: number; onPress: () => void }) {
  const title = waiting ? `You have ${waiting} lucky draw${waiting === 1 ? '' : 's'} waiting` : 'You both win when a friend switches';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${waiting ? 'Open my draws.' : 'Share my code.'}`}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.body}>
        <View style={s.badge}><Ionicons name="gift" size={11} color={colors.orangeAA} /><Text style={s.badgeText}>Lucky draw</Text></View>
        <Text style={s.title}>{title}</Text>
        <Text style={s.sub}>When a friend you referred starts their new plan, you each get a draw. Every draw wins a grocery voucher, up to {sgd(prizeMax())}.</Text>
        <View style={s.cta}>
          <Text style={s.ctaText}>{waiting ? 'Open my draws' : 'Share my code'}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.navy} />
        </View>
      </View>
      <Ionicons name="gift-outline" size={96} color="rgba(255,255,255,0.12)" style={s.art} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.item, backgroundColor: colors.navy, overflow: 'hidden', ...elevate.item },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  body: { padding: space.xl, gap: 6, width: '80%' },
  art: { position: 'absolute', right: -6, bottom: -10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.round, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.orangeAA },
  title: { fontFamily: fonts.head, fontSize: 22, lineHeight: 27, color: colors.white, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#DCE6F2' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#FFB35C', borderRadius: radius.round, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { fontFamily: fonts.head, fontSize: 13, lineHeight: 17, color: colors.navy },
});
