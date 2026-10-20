// Every reward, opened from "See all" on the Rewards tab (it slides in like a
// new page). Tapping an item opens its detail sheet.

import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { LoadFailed, Loading, Screen, Text } from '@/components';
import { RewardCard } from '@/components/RewardCard';
import { RewardDetail } from '@/components/RewardDetail';
import { api } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { CATALOGUE, pointsFor, pts, redeemMessage, shareMessage, type RewardItem } from '@/lib/rewards';
import { openWhatsApp } from '@/lib/whatsapp';
import { colors, space } from '@/theme';

export default function RewardsCatalogue() {
  const { data, error, loading, refresh } = useQuery(() => api.referrals.summary());
  const [open, setOpen] = useState<RewardItem | null>(null);

  if (loading) return <Screen edges={['bottom']}><Loading /></Screen>;
  if (error || !data) return <Screen edges={['bottom']}><LoadFailed onRetry={refresh} /></Screen>;
  const balance = pointsFor(data.successful);

  return (
    <Screen edges={['bottom']}>
      <Text variant="small">You have <Text variant="bodyStrong" color={colors.orangeAA}>{pts(balance)}</Text>. Tap an item to see what it is and how to redeem it.</Text>
      <View style={s.grid}>
        {CATALOGUE.map((item) => (
          <View key={item.id} style={s.cell}><RewardCard item={item} balance={balance} onPress={() => setOpen(item)} /></View>
        ))}
      </View>
      <RewardDetail
        item={open}
        balance={balance}
        onClose={() => setOpen(null)}
        onRedeem={(item) => { setOpen(null); openWhatsApp(redeemMessage(item, data.code)); }}
        onShare={() => Share.share({ message: shareMessage(data.code, data.link) })}
      />
    </Screen>
  );
}

const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.xs },
  cell: { width: '50%', padding: space.xs },
});
