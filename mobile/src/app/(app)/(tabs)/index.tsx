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

      {/* Things you do (functions) — one colour, labelled, so they read as tools, not adverts.
          Only what the menu bar below doesn't already cover. */}
      <View style={{ gap: space.md }}>
        <Text variant="h3">Quick actions</Text>
        <QuickActions
          columns={3}
          items={[
            { icon: 'camera-outline', label: 'Submit a bill', tone: 'blue', onPress: () => router.push('/invoice') },
            { icon: 'logo-whatsapp', label: 'WhatsApp us', tone: 'blue', onPress: () => openWhatsApp(generalMessage()) },
            { icon: 'share-social-outline', label: 'Refer a friend', tone: 'blue', onPress: () => router.navigate('/rewards') },
          ]}
        />
      </View>

      {/* Things to explore (features): rewards, then savings by home type below */}
      <View style={{ gap: space.md }}>
        <View style={s.sectionHead}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="h2">Rewards</Text>
            <Text variant="small">You have <Text variant="bodyStrong" color={colors.orangeAA}>{pts(balance)}</Text>. Earn more when friends switch.</Text>
          </View>
          <Text variant="bodyStrong" color={colors.blue} onPress={() => router.navigate('/rewards')} accessibilityRole="link">See all</Text>
        </View>
        <RewardPromo balance={balance} onPress={() => router.navigate('/rewards')} />
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

/**
 * Where your switch is up to. The whole card opens My switch, so it needs no
 * button of its own. Colour carries one meaning each: green = done / on track,
 * blue = the step you're on now, orange = money saved.
 */
function SwitchSummary({ app }: { app: Application }) {
  const current = app.stages.find((st) => st.state === 'current');
  const step = app.stages.findIndex((st) => st.state === 'current') + 1;
  const active = app.status === 'active';
  const attention = app.status === 'needs_attention';
  const plan = app.plan ? `${app.plan.retailer} · ${app.plan.name}` : 'Plan to be recommended';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Your switch: ${plan}. ${active ? 'Active' : attention ? 'Action needed' : `Step ${step} of ${app.stages.length}, ${current?.label}`}. Open My switch.`}
      onPress={() => router.navigate('/application')}
      style={({ pressed }) => [s.switchCard, pressed && s.pressed]}
    >
      <View style={s.rowBetween}>
        <Text variant="eyebrow">Your switch</Text>
        <Pill
          label={active ? 'Active' : attention ? 'Action needed' : 'In progress'}
          tone={attention ? 'orange' : 'success'}
          icon={active ? 'checkmark-circle' : attention ? 'alert-circle' : undefined}
        />
      </View>
      <View style={s.planRow}>
        <Text variant="h3" style={{ flex: 1 }}>{plan}</Text>
        {app.estimatedSavingYearly > 0 ? (
          <View style={s.saving}>
            <CountUp variant="h2" color={colors.orangeDisplay} value={app.estimatedSavingYearly} format={(n) => money(n)} />
            <Text variant="caption">a year, est.</Text>
          </View>
        ) : null}
      </View>
      <View style={s.progress}>
        {app.stages.map((st) => <View key={st.key} style={[s.seg, st.state === 'done' && s.segDone, st.state === 'current' && s.segNow]} />)}
      </View>
      <View style={s.rowBetween}>
        <Text variant="small" style={{ flex: 1 }}>{active ? 'Your new plan is active.' : attention ? 'We need something from you.' : `Step ${step} of ${app.stages.length}: ${current?.label}`}</Text>
        <View style={s.more}>
          <Text variant="bodyStrong" color={colors.blue}>Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.blue} />
        </View>
      </View>
    </Pressable>
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
  switchCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.card, padding: space.xl, gap: space.md },
  pressed: { backgroundColor: colors.cloud },
  planRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  saving: { alignItems: 'flex-end' },
  more: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  progress: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.cloud },
  segDone: { backgroundColor: colors.successLine },
  segNow: { backgroundColor: colors.blue },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  // Vertical padding leaves room for the cards' shadows inside the scroller.
  rail: { gap: space.md, paddingHorizontal: space.xl, marginHorizontal: -space.xl, paddingTop: 4, paddingBottom: 18 },
});
