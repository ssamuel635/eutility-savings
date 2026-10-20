// Rewards: your points, what they buy (a catalogue with photos, like Grab's
// rewards page), your code to share, and who switched.

import { useState } from 'react';
import { Alert, Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ListRow, LoadFailed, Loading, Pill, Screen, Section, Text } from '@/components';
import { ProgressBar } from '@/components/Motion';
import { PhotoHeader } from '@/components/PhotoHeader';
import { RewardCard } from '@/components/RewardCard';
import { api, type ReferralStatus } from '@/api';
import { CONFIG } from '@/engine';
import { useQuery } from '@/hooks/useQuery';
import { ago } from '@/lib/format';
import { CATALOGUE, pointsFor, pts, type RewardItem } from '@/lib/rewards';
import { openWhatsApp } from '@/lib/whatsapp';
import { colors, fonts, radius, space } from '@/theme';

const STATUS: Record<ReferralStatus, { label: string; tone: 'blue' | 'orange' | 'success' }> = {
  invited: { label: 'Invited', tone: 'blue' },
  signed_up: { label: 'Signed up', tone: 'orange' },
  switched: { label: 'Switched', tone: 'success' },
};

const STEPS = [
  'Share your code or link with friends and family.',
  'They check their savings and switch with Eutility.',
  `Each friend’s switch earns you ${pts(CONFIG.rewards.pointsPerSwitch)}.`,
  'Swap your points for vouchers and appliances.',
];

export default function Rewards() {
  const { data, error, loading, refreshing, refresh } = useQuery(() => api.referrals.summary());
  const [copied, setCopied] = useState(false);

  if (loading) return <Screen tabs><Loading /></Screen>;
  if (error || !data) return <Screen tabs><LoadFailed onRetry={refresh} /></Screen>;

  const message = `I switched my electricity plan with Eutility and saved. Check what you could save — use my code ${data.code}: ${data.link}`;
  const balance = pointsFor(data.successful);
  // The next item they can't afford yet, so the bar always points somewhere.
  const next = CATALOGUE.find((r) => r.points > balance);
  const progress = next ? Math.min(1, balance / next.points) : 1;

  function redeem(item: RewardItem) {
    if (balance < item.points) {
      Alert.alert(item.name, `You need ${pts(item.points - balance)} more. Every friend who switches earns you ${pts(CONFIG.rewards.pointsPerSwitch)}.`);
      return;
    }
    openWhatsApp(`Hi ${CONFIG.brand}, I'd like to redeem ${pts(item.points)} for: ${item.name}.
Referral code: ${data!.code}
(sent from the Eutility app)`);
  }

  async function copy() {
    await Clipboard.setStringAsync(data!.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <PhotoHeader photo="neighbours" title={CONFIG.rewards.programmeName} subtitle="Refer friends, earn points, swap them for things you’ll use." />

      <Card tone="navy">
        <View style={s.rowBetween}>
          <View style={{ gap: 2 }}>
            <Text variant="eyebrow" color="#CFE0F2">Your points</Text>
            <Text style={s.balance}>{balance.toLocaleString('en-SG')}<Text style={s.balanceUnit}> pts</Text></Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 2 }}>
            <Text variant="caption" color="#CFE0F2">Friends switched</Text>
            <Text variant="h2" color={colors.white}>{data.successful}</Text>
          </View>
        </View>
        <View style={{ gap: 6 }}>
          <View accessibilityLabel={next ? `${pts(balance)} of ${pts(next.points)} towards ${next.name}` : 'You can redeem every reward'}>
            <ProgressBar value={progress} trackStyle={s.track} fillStyle={s.fill} />
          </View>
          <Text variant="caption" color="#CFE0F2">
            {next ? `Next up: ${next.name}, ${pts(next.points - balance)} to go.` : 'You can redeem any reward.'}
          </Text>
        </View>
      </Card>

      <Section title="Redeem your points">
        <View style={s.grid}>
          {CATALOGUE.map((item) => (
            <View key={item.id} style={s.cell}><RewardCard item={item} balance={balance} onPress={() => redeem(item)} /></View>
          ))}
        </View>
      </Section>

      <Card>
        <Text variant="eyebrow">Your referral code</Text>
        <Text style={s.code} selectable>{data.code}</Text>
        <Text variant="caption" numberOfLines={1}>{data.link}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label={copied ? 'Copied' : 'Copy link'} icon={copied ? 'checkmark' : 'copy-outline'} variant="secondary" small style={{ flex: 1 }} onPress={copy} />
          <Button label="Share" icon="share-social-outline" small style={{ flex: 1 }} onPress={() => Share.share({ message })} />
        </View>
      </Card>

      {data.referrals.length ? (
        <Section title="Your referrals">
          <Card>
            {data.referrals.map((r, i) => (
              <View key={r.id} style={[s.ref, i < data.referrals.length - 1 && s.refBorder]}>
                <View style={s.avatar}><Text variant="bodyStrong" color={colors.deep}>{r.name.charAt(0)}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyStrong">{r.name}</Text>
                  <Text variant="caption">{ago(r.at)}</Text>
                </View>
                <Pill label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
              </View>
            ))}
          </Card>
        </Section>
      ) : null}

      <Section title="How it works">
        <Card>
          {STEPS.map((t, i) => <ListRow key={t} icon={(['share-social', 'flash', 'star', 'gift'] as const)[i]} tone={(['teal', 'blue', 'orange', 'red'] as const)[i]} label={t} last={i === STEPS.length - 1} />)}
        </Card>
      </Section>

      <Text variant="caption" center>Points are awarded when a friend’s new plan starts. Items are subject to availability. Terms apply.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  balance: { fontFamily: fonts.head, fontSize: 36, lineHeight: 42, color: colors.white, letterSpacing: -0.8 },
  balanceUnit: { fontFamily: fonts.head, fontSize: 16, color: '#FFB35C', letterSpacing: 0 },
  code: { fontFamily: fonts.head, fontSize: 28, lineHeight: 34, color: colors.ink, letterSpacing: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  cell: { width: '50%', padding: space.xs },
  track: { height: 8, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: '#FFB35C' },
  ref: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  refBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
});
