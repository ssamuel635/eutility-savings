// Referrals: your code, share it, see who switched.

import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Card, ListRow, LoadFailed, Loading, Pill, Screen, Section, Stat, Text } from '@/components';
import { ProgressBar } from '@/components/Motion';
import { api, type ReferralStatus } from '@/api';
import { CONFIG } from '@/engine';
import { useQuery } from '@/hooks/useQuery';
import { ago } from '@/lib/format';
import { colors, radius, space } from '@/theme';

const STATUS: Record<ReferralStatus, { label: string; tone: 'grey' | 'blue' | 'green' }> = {
  invited: { label: 'Invited', tone: 'grey' },
  signed_up: { label: 'Signed up', tone: 'blue' },
  switched: { label: 'Switched', tone: 'green' },
};

const STEPS = [
  'Share your code or link with friends and family.',
  'They check their savings and switch with Eutility.',
  'Each switch counts towards your next reward.',
];

export default function Rewards() {
  const { data, error, loading, refreshing, refresh } = useQuery(() => api.referrals.summary());
  const [copied, setCopied] = useState(false);

  if (loading) return <Screen tabs><Loading /></Screen>;
  if (error || !data) return <Screen tabs><LoadFailed onRetry={refresh} /></Screen>;

  const message = `I switched my electricity plan with Eutility and saved. Check what you could save — use my code ${data.code}: ${data.link}`;
  const progress = Math.min(1, data.successful / data.nextRewardAt);

  async function copy() {
    await Clipboard.setStringAsync(data!.link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Screen tabs refreshing={refreshing} onRefresh={refresh}>
      <View style={{ gap: space.sm }}>
        <Text variant="h1">{CONFIG.rewards.programmeName}</Text>
        <Text variant="body">Got a friend still overpaying? Send them your code.</Text>
      </View>

      <Card tone="navy">
        <Text variant="eyebrow" color="#CFE0F2">Your referral code</Text>
        <Text variant="display" color={colors.white} style={{ fontFamily: 'Inter_700Bold', letterSpacing: 3 }} selectable>{data.code}</Text>
        <Text variant="caption" color="#CFE0F2" numberOfLines={1}>{data.link}</Text>
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Button label={copied ? 'Copied' : 'Copy link'} icon={copied ? 'checkmark' : 'copy-outline'} variant="secondary" small style={{ flex: 1 }} onPress={copy} />
          <Button label="Share" icon="share-social-outline" variant="secondary" small style={{ flex: 1 }} onPress={() => Share.share({ message })} />
        </View>
      </Card>

      <Card>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          <Stat value={String(data.referred)} label="Referred" />
          <Stat value={String(data.successful)} label="Switched" tone={colors.green} />
          <Stat value={data.rewardsEarned === null ? '—' : `S$${data.rewardsEarned}`} label="Rewards earned" tone={colors.orangeDisplay} />
        </View>
        <View style={{ gap: 6 }}>
          <View accessibilityLabel={`${data.successful} of ${data.nextRewardAt} switches towards your next reward`}>
            <ProgressBar value={progress} trackStyle={s.track} fillStyle={s.fill} />
          </View>
          <Text variant="caption">
            {data.successful >= data.nextRewardAt ? 'You’ve reached your next reward.' : `${data.nextRewardAt - data.successful} more switch${data.nextRewardAt - data.successful === 1 ? '' : 'es'} to your next reward.`}
          </Text>
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
          {STEPS.map((t, i) => <ListRow key={t} icon={(['share-social-outline', 'flash-outline', 'trophy-outline'] as const)[i]} label={t} last={i === STEPS.length - 1} />)}
        </Card>
      </Section>

      <Text variant="caption" center>Reward amounts are announced with each campaign. Terms apply.</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  track: { height: 8, borderRadius: 2, backgroundColor: colors.cloud, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2, backgroundColor: colors.orange },
  ref: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  refBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
});
