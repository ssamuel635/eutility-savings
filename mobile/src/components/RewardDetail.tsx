// One reward, in a sheet that slides up (like Grab's reward pages): the photo,
// what it is, its points and how close you are, how redeeming works, and the
// one action that fits — redeem if you have the points, share your code if not.

import { Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { CONFIG } from '@/engine';
import { pts, REDEEM_NOTES, type RewardItem } from '@/lib/rewards';
import { colors, fonts, radius, space } from '@/theme';
import { Button } from './Button';
import { ProgressBar } from './Motion';
import { Text } from './Text';

interface Props {
  item: RewardItem | null;
  balance: number;
  onClose: () => void;
  onRedeem: (item: RewardItem) => void;
  onShare: () => void;
}

export function RewardDetail({ item, balance, onClose, onRedeem, onShare }: Props) {
  if (!item) return null;
  const ready = balance >= item.points;
  const short = item.points - balance;
  const friends = Math.ceil(Math.max(0, short) / CONFIG.rewards.pointsPerSwitch);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView edges={['bottom']} style={s.sheet}>
        <View style={s.grab} />
        <ScrollView contentContainerStyle={s.body} bounces={false}>
          <View style={s.imgWrap}>
            {item.image ? <Image source={item.image} style={s.img} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Ionicons name="gift-outline" size={48} color={colors.inkMuted} />}
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8} style={s.close}>
              <Ionicons name="close" size={20} color={colors.ink} />
            </Pressable>
          </View>

          <View style={{ gap: 6 }}>
            <Text variant="h2">{item.name}</Text>
            <View style={s.ptsRow}>
              <Ionicons name="star" size={15} color={colors.orange} />
              <Text style={s.pts}>{pts(item.points)}</Text>
            </View>
            {item.about ? <Text variant="body">{item.about}</Text> : null}
          </View>

          <View style={s.progressBox} accessibilityLabel={ready ? 'You have enough points to redeem this' : `${pts(balance)} of ${pts(item.points)}`}>
            <View style={s.rowBetween}>
              <Text variant="bodyStrong">{ready ? 'You can redeem this' : `${pts(short)} to go`}</Text>
              <Text variant="caption">{pts(balance)} of {pts(item.points)}</Text>
            </View>
            <ProgressBar value={Math.min(1, balance / item.points)} trackStyle={s.track} fillStyle={s.fill} />
            {!ready ? <Text variant="caption">{friends} more friend{friends === 1 ? '' : 's'} switching gets you there.</Text> : null}
          </View>

          <View style={{ gap: space.sm }}>
            <Text variant="h3">How redeeming works</Text>
            {REDEEM_NOTES.map((n) => (
              <View key={n} style={s.note}>
                <Ionicons name="checkmark-circle-outline" size={18} color={colors.blue} style={{ marginTop: 1 }} />
                <Text variant="small" style={{ flex: 1 }}>{n}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
        <View style={s.footer}>
          {ready
            ? <Button label="Redeem on WhatsApp" variant="whatsapp" icon="logo-whatsapp" onPress={() => onRedeem(item)} />
            : <Button label="Share my code to earn points" icon="share-social-outline" onPress={onShare} />}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(17, 24, 39, 0.45)' },
  sheet: { maxHeight: '88%', backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  grab: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 8 },
  body: { padding: space.xl, gap: space.xl },
  imgWrap: { aspectRatio: 16 / 10, borderRadius: radius.item, overflow: 'hidden', backgroundColor: colors.cloud, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  close: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  ptsRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  pts: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.orangeAA },
  progressBox: { gap: space.sm, padding: space.lg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cloud, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.blue },
  note: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md, paddingBottom: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
