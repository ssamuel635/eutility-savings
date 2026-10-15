// Home: a local photo fading into the page, where your switch is up to, the
// few shortcuts the menu bar doesn't already give you, this month's headline
// reward, then rewards and savings by home type.

import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, Pill, QuickActions, Screen, Text } from '@/components';
import { CountUp } from '@/components/Motion';
import { HomeStories } from '@/components/HomeStories';
import { PhotoHeader } from '@/components/PhotoHeader';
import { RewardCard } from '@/components/RewardCard';
import { RewardPromo } from '@/components/RewardPromo';
import { api, type Application, type Notice, type SavingsQuote } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { firstName, greeting, money } from '@/lib/format';
import { CATALOGUE, FEATURED, pointsFor, pts } from '@/lib/rewards';
import { generalMessage, openWhatsApp } from '@/lib/whatsapp';
import { useCustomer } from '@/state/session';
import { colors, radius, space } from '@/theme';

export default function Home() {
  const customer = useCustomer();
  const { data, refreshing, refresh } = useQuery(async () => {
    const [apps, quote, notices, referrals] = await Promise.all([
      api.applications.list(), api.savings.latest(), api.notifications.list(), api.referrals.summary(),
    ]);
    return { app: apps[0] ?? null, quote, unread: notices.filter((n: Notice) => !n.read).length, switched: referrals.successful };
  });
  const balance = pointsFor(data?.switched ?? 0);

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <PhotoHeader
        photo="familyMeal"
        title={`${greeting()}, ${firstName(customer.fullName)}`}
        subtitle="Let’s get your electricity bill under control."
        badge={
          <View style={s.logoPlate}>
            <Image source={require('../../../../assets/eutility-logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Eutility — get control" />
          </View>
        }
        corner={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={data?.unread ? `Updates, ${data.unread} unread` : 'Updates'}
            onPress={() => router.push('/notifications')}
            style={s.bell}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.ink} />
            {data?.unread ? <View style={s.badge} /> : null}
          </Pressable>
        }
      />

      {data === undefined ? <Card><Text variant="small">Loading your account…</Text></Card>
        : data.app ? <SwitchSummary app={data.app} /> : <StartSummary quote={data.quote} />}

      {/* Only what the menu bar below doesn't already cover */}
      <QuickActions
        columns={3}
        items={[
          { icon: 'camera', label: 'Submit a bill', tone: 'orange', onPress: () => router.push('/invoice') },
          { icon: 'logo-whatsapp', label: 'WhatsApp us', tone: 'green', onPress: () => openWhatsApp(generalMessage()) },
          { icon: 'share-social', label: 'Refer a friend', tone: 'red', onPress: () => router.navigate('/rewards') },
        ]}
      />

      <RewardPromo balance={balance} onPress={() => router.navigate('/rewards')} />

      <View style={{ gap: space.md }}>
        <View style={s.headRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h2">Redeem your points</Text>
            <Text variant="small">You have <Text variant="bodyStrong" color={colors.orangeAA}>{pts(balance)}</Text>. Earn more when friends switch.</Text>
          </View>
          <Text variant="bodyStrong" color={colors.blue} onPress={() => router.navigate('/rewards')} accessibilityRole="link">See all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.rail} decelerationRate="fast" snapToInterval={140 + space.md} snapToAlignment="start" disableIntervalMomentum>
          {CATALOGUE.filter((r) => r.id !== FEATURED?.id).slice(0, 6).map((item) => (
            <RewardCard key={item.id} item={item} balance={balance} width={140} onPress={() => router.navigate('/rewards')} />
          ))}
        </ScrollView>
      </View>

      <HomeStories />
    </Screen>
  );
}

function SwitchSummary({ app }: { app: Application }) {
  const current = app.stages.find((st) => st.state === 'current');
  const done = app.stages.filter((st) => st.state === 'done').length;
  const active = app.status === 'active';
  return (
    <Card style={s.status}>
      <View style={s.rowBetween}>
        <Text variant="eyebrow">Your electricity switch</Text>
        <Pill label={active ? 'Active' : app.status === 'needs_attention' ? 'Action needed' : 'Processing'} tone={active ? 'green' : app.status === 'needs_attention' ? 'orange' : 'blue'} />
      </View>
      <Text variant="h2">{app.plan ? `${app.plan.retailer} · ${app.plan.name}` : 'Plan to be recommended'}</Text>
      {app.estimatedSavingYearly > 0 ? (
        <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
          <CountUp variant="figure" value={app.estimatedSavingYearly} format={(n) => money(n)} />
          <Text variant="body"> a year, estimated</Text>
        </View>
      ) : null}
      <View style={s.progress} accessibilityLabel={`Step ${done} of ${app.stages.length}`}>
        {app.stages.map((st) => <View key={st.key} style={[s.seg, st.state === 'done' && { backgroundColor: colors.blue }, st.state === 'current' && { backgroundColor: colors.orange }]} />)}
      </View>
      <Text variant="small">{active ? 'Your new plan is active.' : `Now: ${current?.label}`}</Text>
      <Button label="View my switch" small icon="arrow-forward" onPress={() => router.navigate('/application')} />
    </Card>
  );
}

function StartSummary({ quote }: { quote: SavingsQuote | null }) {
  const rec = quote?.recommended;
  return (
    <Card style={s.status}>
      {rec ? (
        <>
          <Text variant="eyebrow">Your last savings check</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp variant="figure" value={rec.savingYearly} format={(n) => money(n)} />
            <Text variant="body"> a year</Text>
          </View>
          <Text variant="small">With {rec.plan.retailer} {rec.plan.name}. Send us your latest bill and we’ll handle the switch.</Text>
          <Button label="Submit my bill" small icon="camera-outline"
            onPress={() => router.push({ pathname: '/invoice', params: { planId: rec.plan.id, quoteId: quote!.id, saving: String(rec.savingYearly) } })} />
        </>
      ) : (
        <>
          <Text variant="h2">See what you could save in 30 seconds.</Text>
          <Text variant="small">Tell us your usage and current plan, and we’ll compare every plan for you.</Text>
          <Button label="Check my savings" small icon="flash-outline" onPress={() => router.navigate('/savings')} />
        </>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  logoPlate: { backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  logo: { height: 24, width: 24 * (314 / 112) },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  badge: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 1.5, borderColor: colors.white },
  // The status card's blue top edge ties it to the brand without a navy slab.
  status: { borderTopWidth: 3, borderTopColor: colors.blue },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 1, backgroundColor: colors.cloud },
  headRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  // Vertical padding leaves room for the cards' shadows inside the scroller.
  rail: { gap: space.md, paddingHorizontal: space.xl, marginHorizontal: -space.xl, paddingTop: 4, paddingBottom: 18 },
});
