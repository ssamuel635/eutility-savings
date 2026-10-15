// This month's headline reward (CONFIG.rewards.featured): a lifted navy card
// with the item's photo, how many friends it takes, and a button to share.

import { Image, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '@/engine';
import { FEATURED, pts } from '@/lib/rewards';
import { colors, elevate, fonts, radius, space } from '@/theme';
import { Text } from './Text';

const MONTH = new Date().toLocaleDateString('en-SG', { month: 'long', timeZone: 'Asia/Singapore' });

export function RewardPromo({ balance, onPress }: { balance: number; onPress: () => void }) {
  const item = FEATURED;
  if (!item) return null;
  const friends = Math.ceil(Math.max(0, item.points - balance) / CONFIG.rewards.pointsPerSwitch);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${MONTH}'s top reward: ${item.name}, ${pts(item.points)}. Share my code.`}
      onPress={onPress}
      style={({ pressed }) => [s.card, pressed && s.pressed]}
    >
      <View style={s.clip}>
        {item.image ? <Image source={item.image} style={s.img} resizeMode="cover" /> : null}
        {/* Navy wash from the left, so the words sit on colour and the item shows on the right */}
        <LinearGradient
          pointerEvents="none"
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          colors={['rgba(41,70,113,1)', 'rgba(41,70,113,0.92)', 'rgba(41,70,113,0)']}
          locations={[0, 0.5, 0.85]}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.body}>
          <View style={s.badge}><Ionicons name="star" size={11} color={colors.orangeAA} /><Text style={s.badgeText}>{MONTH}’s top reward</Text></View>
          <Text style={s.title}>Earn a {item.name}</Text>
          <Text style={s.sub}>{friends > 0 ? `${friends} friend${friends === 1 ? '' : 's'} switching gets you there.` : 'You have enough points to redeem it.'}</Text>
          <View style={s.cta}>
            <Text style={s.ctaText}>Share my code</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.navy} />
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.item, backgroundColor: colors.navy, ...elevate.item },
  clip: { borderRadius: radius.item, overflow: 'hidden', minHeight: 176 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.94 },
  img: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '62%', height: '100%' },
  body: { padding: space.xl, gap: 6, width: '68%' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: colors.white, borderRadius: radius.round, paddingHorizontal: 9, paddingVertical: 2 },
  badgeText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.orangeAA },
  title: { fontFamily: fonts.head, fontSize: 22, lineHeight: 27, color: colors.white, letterSpacing: -0.3 },
  sub: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18, color: '#DCE6F2' },
  cta: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 6, backgroundColor: '#FFB35C', borderRadius: radius.round, paddingHorizontal: 14, paddingVertical: 8 },
  ctaText: { fontFamily: fonts.head, fontSize: 13, lineHeight: 17, color: colors.navy },
});
