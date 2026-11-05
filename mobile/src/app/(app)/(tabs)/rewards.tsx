// Rewards: the referral lucky draw. The top card holds the whole loop: draws
// waiting (and how close the next bonus is), your code to share, and each
// friend's progress (numbered, never named). Then how it works and the bonus
// draws. A draw opens the website's draw page, the same link sent on WhatsApp.

import { useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, LoadFailed, Loading, Pill, Screen, Text } from '@/components';
import { ProgressBar } from '@/components/Motion';
import { PhotoHeader } from '@/components/PhotoHeader';
import { api, type Draw } from '@/api';
import { CONFIG, bonusAt, nextBonus, prizeMax, prizeMin, topOdds } from '@/engine';
import { useQuery } from '@/hooks/useQuery';
import { ago } from '@/lib/format';
import { FRIEND_STATUS, RULES_URL, ordinal, sgd, shareMessage } from '@/lib/rewards';
import { colors, fonts, space } from '@/theme';

const R = CONFIG.rewards;

const STEPS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'share-social-outline', text: 'Share your code' },
  { icon: 'flash-outline', text: 'A friend switches' },
  { icon: 'gift-outline', text: 'You both get a draw' },
  { icon: 'trophy-outline', text: 'Spin to win a voucher' },
];

const SHOWN_FRIENDS = 3;

export default function Rewards() {
  const { data, error, loading, refreshing, refresh } = useQuery(() => api.referrals.summary());
  const [copied, setCopied] = useState(false);
  const [allFriends, setAllFriends] = useState(false);

  if (loading) return <Screen tabs><Loading /></Screen>;
  if (error || !data) return <Screen tabs><LoadFailed onRetry={refresh} /></Screen>;

  const waiting = data.draws.filter((d) => d.status === 'ready');
  const next = nextBonus(data.successful)!;
  let prev = data.successful; // the last bonus reached (or 0), so the bar fills from there
  while (prev > 0 && !bonusAt(prev)) prev--;
  const progress = (data.successful - prev) / (next.at - prev);
  const share = () => Share.share({ message: shareMessage(data.code, data.link) });
  const friends = allFriends ? data.referrals : data.referrals.slice(0, SHOWN_FRIENDS);
  const last = R.bonusDraws[R.bonusDraws.length - 1].at;

  async function copy() {
    await Clipboard.setStringAsync(data!.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <PhotoHeader photo="neighbours" title={R.programmeName} subtitle="Refer a friend. When their new plan starts, you both get a lucky draw." />

      {data.sample ? <Text variant="caption" color={colors.orangeAA}>Sample data for review. Draws open sample draws that never pay out.</Text> : null}

      <Card>
        {/* Draws waiting, and the next bonus */}
        <View style={s.rowBetween}>
          <View style={{ gap: 2 }}>
            <Text variant="eyebrow">Draws waiting</Text>
            <Text style={s.balance}>{waiting.length}<Text style={s.balanceUnit}> {waiting.length === 1 ? 'draw' : 'draws'}</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="caption">Friends switched</Text>
            <Text variant="h2">{data.successful}</Text>
          </View>
        </View>
        <View style={{ gap: 6 }} accessibilityLabel={`${next.toGo} more friends for a bonus of ${next.extra} draws`}>
          <ProgressBar value={progress} trackStyle={s.track} fillStyle={s.fill} />
          <Text variant="caption">{next.toGo === 1 ? 'One more friend' : `${next.toGo} more friends`} for a bonus (+{next.extra} draw{next.extra === 1 ? '' : 's'}).</Text>
        </View>
        {data.draws.length ? data.draws.map((d, i) => <DrawRow key={d.id} draw={d} last={i === data.draws.length - 1} />) : (
          <Text variant="small">No draws yet. When a friend’s new plan starts, we’ll send your draw link on WhatsApp and show it here.</Text>
        )}

        {/* Your code */}
        <View style={s.divider} />
        <View style={{ gap: 2 }}>
          <Text variant="eyebrow">Your referral code</Text>
          <Text style={s.code} selectable>{data.code}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label="Share" icon="share-social-outline" small style={{ flex: 1 }} onPress={share} />
          <Button label={copied ? 'Copied' : 'Copy link'} icon={copied ? 'checkmark' : 'copy-outline'} variant="secondary" small style={{ flex: 1 }} onPress={copy} />
        </View>

        {/* Friends who used it: numbered, never named */}
        <View style={s.divider} />
        <Text variant="eyebrow">Your friends</Text>
        {data.referrals.length ? (
          <>
            {friends.map((r, i) => (
              <View key={r.id} style={[s.row, i < friends.length - 1 && s.rowBorder]}>
                <View style={s.avatar}><Text variant="bodyStrong" color={colors.deep}>{r.number}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">Friend {r.number}</Text>
                  <Text variant="caption">{ago(r.at)}</Text>
                </View>
                <Pill label={FRIEND_STATUS[r.status].label} tone={FRIEND_STATUS[r.status].tone} />
              </View>
            ))}
            {data.referrals.length > SHOWN_FRIENDS ? (
              <Text variant="bodyStrong" color={colors.blue} accessibilityRole="button" onPress={() => setAllFriends(!allFriends)}>
                {allFriends ? 'Show fewer' : `Show all ${data.referrals.length}`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text variant="small">No one yet. Friends who use your code show up here, from invited to supply started. We don’t show names.</Text>
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

      <View style={{ gap: space.sm }}>
        <Text variant="h3">Bonus draws</Text>
        <Card>
          <Ladder label="Every friend whose plan starts" value="1 draw each" />
          {R.bonusDraws.map((b) => <Ladder key={b.at} label={`Your ${ordinal(b.at)} friend`} value={`+${b.extra} bonus draw${b.extra === 1 ? '' : 's'}`} />)}
          <Ladder label={`Every ${R.repeatEvery} friends after that (${last + R.repeatEvery}, ${last + 2 * R.repeatEvery} …)`} value={`+${R.repeatExtra} bonus draws`} />
        </Card>
      </View>

      <Text variant="caption" center>
        Every draw wins a {R.voucherShops} voucher from {sgd(prizeMin())} to {sgd(prizeMax())}. The top prize has a {topOdds()} chance per draw.{' '}
        <Text variant="caption" color={colors.blue} accessibilityRole="link" onPress={() => Linking.openURL(RULES_URL)}>Draw rules</Text>
      </Text>
    </Screen>
  );
}

function DrawRow({ draw, last }: { draw: Draw; last: boolean }) {
  const used = draw.status === 'drawn';
  return (
    <View style={[s.row, !last && s.rowBorder]}>
      <View style={[s.drawIcon, used && s.drawIconUsed]}><Ionicons name={used ? 'checkmark' : 'gift'} size={18} color={used ? colors.inkMuted : colors.orangeAA} /></View>
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong">{draw.kind === 'bonus' ? 'Bonus draw' : draw.kind === 'friend' ? 'Welcome draw' : `Friend ${draw.friend} switched`}</Text>
        <Text variant="caption">{used ? `Won a ${sgd(draw.prize ?? 0)} voucher` : draw.link ? `Ready · ${ago(draw.at)}` : 'Your link is on WhatsApp'}</Text>
      </View>
      {!used && draw.link ? <Button label="Spin" small onPress={() => Linking.openURL(draw.link!)} /> : null}
    </View>
  );
}

function Ladder({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.ladder}>
      <Text variant="small" style={{ flex: 1 }}>{label}</Text>
      <Text variant="bodyStrong" color={colors.orangeAA}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: space.md },
  balance: { fontFamily: fonts.head, fontSize: 36, lineHeight: 42, color: colors.heading, letterSpacing: -0.8 },
  balanceUnit: { fontFamily: fonts.head, fontSize: 16, color: colors.orangeAA, letterSpacing: 0 },
  code: { fontFamily: fonts.head, fontSize: 24, lineHeight: 30, color: colors.navy, letterSpacing: 3 },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.cloud, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: colors.blue },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  drawIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFF3E0', alignItems: 'center', justifyContent: 'center' },
  drawIconUsed: { backgroundColor: colors.cloud },
  steps: { flexDirection: 'row', gap: space.sm },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(0, 123, 184, 0.35)', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  ladder: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 4 },
});
