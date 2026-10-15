// One item in the rewards catalogue: its photo, name and points, and how close
// the customer is to it.

import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { pts, type RewardItem } from '@/lib/rewards';
import { colors, elevate, fonts, radius, space } from '@/theme';
import { Text } from './Text';

export function RewardCard({ item, balance, width, onPress }: { item: RewardItem; balance: number; width?: number; onPress?: () => void }) {
  const ready = balance >= item.points;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${pts(item.points)}${ready ? ', you can redeem this' : `, ${pts(item.points - balance)} to go`}`}
      onPress={onPress}
      style={({ pressed }) => [s.card, width ? { width } : { flex: 1 }, pressed && s.pressed]}
    >
      <View style={s.clip}>
      <View style={s.imgWrap}>
        {item.image ? <Image source={item.image} style={s.img} resizeMode="cover" /> : <Ionicons name="gift-outline" size={36} color={colors.inkMuted} />}
        {ready ? <View style={s.ready}><Text style={s.readyText}>Redeem</Text></View> : null}
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={2}>{item.name}</Text>
        <View style={s.ptsRow}>
          <Ionicons name="star" size={13} color={colors.orange} />
          <Text style={s.pts}>{pts(item.points)}</Text>
        </View>
      </View>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // Shadow outside, clipping inside: iOS drops shadows on clipped views.
  card: { backgroundColor: colors.white, borderRadius: radius.item, ...elevate.item },
  clip: { borderRadius: radius.item, overflow: 'hidden' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.92 },
  imgWrap: { aspectRatio: 1, backgroundColor: colors.cloud, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  ready: { position: 'absolute', left: 8, top: 8, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.blue, borderRadius: radius.round, paddingHorizontal: 7, paddingVertical: 1 },
  readyText: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 15, color: colors.deep },
  body: { padding: space.md, gap: 4 },
  name: { fontFamily: fonts.headSemi, fontSize: 14, lineHeight: 19, color: colors.ink, minHeight: 38 },
  ptsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pts: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 17, color: colors.orangeAA },
});
