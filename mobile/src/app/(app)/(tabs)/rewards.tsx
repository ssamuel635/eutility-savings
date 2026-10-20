// Rewards. The top card holds the whole loop in one place — your points, your
// code to share, and the friends who used it — because each drives the next:
// share → friends switch → points. Then how it works, then what points buy (a
// row to browse, "See all" for the full catalogue, a detail sheet per item).

import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, LoadFailed, Loading, Pill, Screen, Text } from '@/components';
import { ProgressBar } from '@/components/Motion';
import { PhotoHeader } from '@/components/PhotoHeader';
import { RewardCard } from '@/components/RewardCard';
import { RewardDetail } from '@/components/RewardDetail';
import { api, type ReferralStatus } from '@/api';
import { CONFIG } from '@/engine';
import { useQuery } from '@/hooks/useQuery';
import { ago } from '@/lib/format';
import { CATALOGUE, pointsFor, pts, redeemMessage, shareMessage, type RewardItem } from '@/lib/rewards';
import { openWhatsApp } from '@/lib/whatsapp';
import { colors, fonts, space } from '@/theme';

const STATUS: Record<ReferralStatus, { label: string; tone: 'blue' | 'orange' | 'success' }> = {
  invited: { label: 'Invited', tone: 'blue' },
  signed_up: { label: 'Signed up', tone: 'orange' },
  switched: { label: 'Switched', tone: 'success' },
};

const STEPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'share-social-outline', text: 'Share your code' },
  { icon: 'flash-outline', text: 'A friend switches' },
  { icon: 'star-outline', text: `You earn ${pts(CONFIG.rewards.pointsPerSwitch)}` },
  { icon: 'gift-outline', text: 'Swap points for rewards' },
];

const SHOWN_REFERRALS = 3;
const CARD_W = 150;

export default function Rewards() {
  const { data, error, loading, refreshing, refresh } = useQuery(() => api.referrals.summary());
  const [copied, setCopied] = useState(false);
  const [allRefs, setAllRefs] = useState(false);
  const [open, setOpen] = useState<RewardItem | null>(null);

  if (loading) return <Screen tabs><Loading /></Screen>;
  if (error || !data) return <Screen tabs><LoadFailed onRetry={refresh} /></Screen>;

  const balance = pointsFor(data.successful);
  // The next item they can't afford yet, so the bar always points somewhere.
  const next = CATALOGUE.find((r) => r.points > balance);
  const progress = next ? Math.min(1, balance / next.points) : 1;
  const share = () => Share.share({ message: shareMessage(data.code, data.link) });
  const refs = allRefs ? data.referrals : data.referrals.slice(0, SHOWN_REFERRALS);

  async function copy() {
    await Clipboard.setStringAsync(data!.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <PhotoHeader photo="neighbours" title={CONFIG.rewards.programmeName} subtitle="Refer friends, earn points, swap them for things you’ll use." />

      <Card>
        {/* Points */}
        <View style={s.rowBetween}>
          <View style={{ gap: 2 }}>
            <Text variant="eyebrow">Your points</Text>
            <Text style={s.balance}>{balance.toLocaleString('en-SG')}<Text style={s.balanceUnit}> pts</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="caption">Friends switched</Text>
            <Text variant="h2">{data.successful}</Text>
          </View>
        </View>
        <View style={{ gap: 6 }} accessibilityLabel={next ? `${pts(balance)} of ${pts(next.points)} towards ${next.name}` : 'You can redeem every reward'}>
          <ProgressBar value={progress} trackStyle={s.track} fillStyle={s.fill} />
          <Text variant="caption">{next ? `Next up: ${next.name}, ${pts(next.points - balance)} to go.` : 'You can redeem any reward.'}</Text>
        </View>

        {/* Your code */}
        <View style={s.divider} />
        <View style={s.rowBetween}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="eyebrow">Your referral code</Text>
            <Text style={s.code} selectable>{data.code}</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Share" icon="share-social-outline" small style={{ flex: 1 }} onPress={share} />
          <Button label={copied ? 'Copied' : 'Copy link'} icon={copied ? 'checkmark' : 'copy-outline'} variant="secondary" small style={{ flex: 1 }} onPress={copy} />
        </View>

        {/* Who used it */}
        <View style={s.divider} />
        <Text variant="eyebrow">Your referrals</Text>
        {data.referrals.length ? (
          <>
            {refs.map((r, i) => (
              <View key={r.id} style={[s.ref, i < refs.length - 1 && s.refBorder]}>
                <View style={s.avatar}><Text variant="bodyStrong" color={colors.deep}>{r.name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.name}</Text>
                  <Text variant="caption">{ago(r.at)}</Text>
                </View>
                <Pill label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </View>
            ))}
            {data.referrals.length > SHOWN_REFERRALS ? (
              <Text variant="bodyStrong" color={colors.blue} accessibilityRole="button" onPress={() => setAllRefs(!allRefs)}>
                {allRefs ? 'Show fewer' : `Show all ${data.referrals.length}`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="small">No one yet. Friends who use your code show up here, from invited to switched.</Text>
        )}
      </Card>

      <View style={{ gap: space.md }}>
        <Text variant="h3">How it works</Text>
        <View style={s.steps}>
          {STEPS.map((st, i) => (
            <View key={st.text} style={s.step} accessible accessibilityLabel={`Step ${i + 1}: ${st.text}`}>
              <View style={s.stepIcon}><Ionicons name={st.icon} size={20} color={colors.blue} /></View>
              <Text variant="caption" center color={colors.ink}>{st.text}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ gap: space.md }}>
        <View style={s.rowBetween}>
          <Text variant="h2">Redeem your points</Text>
          <Text variant="bodyStrong" color={colors.blue} accessibilityRole="link" onPress={() => router.push('/rewards-catalogue')}>See all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail} decelerationRate="fast" snapToInterval={CARD_W + space.md} snapToAlignment="start" disableIntervalMomentum>
          {CATALOGUE.map((item) => <RewardCard key={item.id} item={item} balance={balance} width={CARD_W} onPress={() => setOpen(item)} />)}
        </ScrollView>
      </View>

      <Text variant="caption" center>Points are awarded when a friend’s new plan starts. Items are subject to availability. Terms apply.</Text>

      <RewardDetail
        item={open}
        balance={balance}
        onClose={() => setOpen(null)}
        onRedeem={(item) => { setOpen(null); openWhatsApp(redeemMessage(item, data.code)); }}
        onShare={() => { setOpen(null); share(); }}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md },
  balance: { fontFamily: fonts.head, fontSize: 36, lineHeight: 42, color: colors.ink, letterSpacing: -0.8 },
  balanceUnit: { fontFamily: fonts.head, fontSize: 16, color: colors.orangeAA, letterSpacing: 0 },
  code: { fontFamily: fonts.head, fontSize: 24, lineHeight: 30, color: colors.navy, letterSpacing: 3 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cloud, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.blue },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  ref: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  refBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: space.sm },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(0, 123, 184, 0.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  // Vertical padding leaves room for the cards' shadows inside the scroller.
  rail: { gap: space.md, paddingHorizontal: space.xl, marginHorizontal: -space.xl, paddingTop: 4, paddingBottom: 18 },
});
