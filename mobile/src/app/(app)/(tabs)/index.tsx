// Home: a navy hero with where your switch is up to, then quick actions.

import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Button, Card, ListRow, Pill, Screen, Text } from '@/components';
import { CountUp } from '@/components/Motion';
import { api, type Application, type Notice, type SavingsQuote } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { firstName, greeting, money } from '@/lib/format';
import { generalMessage, openWhatsApp } from '@/lib/whatsapp';
import { useCustomer } from '@/state/session';
import { colors, radius, space } from '@/theme';

const ON_HERO = '#C9D8EA'; // secondary text on the navy hero (7:1)

export default function Home() {
  const customer = useCustomer();
  const insets = useSafeAreaInsets();
  const { data, refreshing, refresh } = useQuery(async () => {
    const [apps, quote, notices] = await Promise.all([api.applications.list(), api.savings.latest(), api.notifications.list()]);
    return { app: apps[0] ?? null, quote, unread: notices.filter((n: Notice) => !n.read).length };
  });

  // White status bar text over the navy hero, dark everywhere else.
  useFocusEffect(useCallback(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, []));

  return (
    <Screen tabs edges={[]} refreshing={refreshing} onRefresh={refresh}>
      <View style={[s.hero, { paddingTop: insets.top + space.md }]}>
        <View style={s.heroTop}>
          <View style={s.logoPlate}>
            <Image source={require('../../../../assets/eutility-logo.png')} style={s.logo} resizeMode="contain" accessibilityLabel="Eutility — get control" />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={data?.unread ? `Updates, ${data.unread} unread` : 'Updates'}
            onPress={() => router.push('/notifications')}
            style={s.bell}
            hitSlop={8}
          >
            <Ionicons name="notifications-outline" size={22} color={colors.white} />
            {data?.unread ? <View style={s.badge} /> : null}
          </Pressable>
        </View>
        <Text variant="h1" color={colors.white}>{greeting()}, {firstName(customer.fullName)}</Text>
        {data === undefined ? <Text variant="small" color={ON_HERO}>Loading your account…</Text>
          : data.app ? <SwitchSummary app={data.app} /> : <StartSummary quote={data.quote} />}
      </View>

      <Card style={{ paddingVertical: space.xs }}>
        <ListRow icon="camera-outline" label="Submit a bill" onPress={() => router.push('/invoice')} />
        <ListRow icon="flash-outline" label="Check my savings" onPress={() => router.navigate('/savings')} />
        <ListRow icon="gift-outline" label="Refer a friend" onPress={() => router.navigate('/rewards')} />
        <ListRow icon="logo-whatsapp" label="Chat with us on WhatsApp" onPress={() => openWhatsApp(generalMessage())} last />
      </Card>

      <Card tone="orange">
        <Text variant="h3">Got a friend still overpaying?</Text>
        <Text variant="small">Share your code <Text variant="bodyStrong">{customer.referralCode}</Text> and earn rewards when they switch.</Text>
        <Button label="Share my code" variant="light" small icon="share-social-outline" onPress={() => router.navigate('/rewards')} style={{ alignSelf: 'flex-start' }} />
      </Card>
    </Screen>
  );
}

function SwitchSummary({ app }: { app: Application }) {
  const current = app.stages.find((st) => st.state === 'current');
  const done = app.stages.filter((st) => st.state === 'done').length;
  const active = app.status === 'active';
  return (
    <View style={s.summary}>
      <View style={s.rowBetween}>
        <Text variant="eyebrow" color={ON_HERO}>Your electricity switch</Text>
        <Pill label={active ? 'Active' : app.status === 'needs_attention' ? 'Action needed' : 'Processing'} tone={active ? 'green' : app.status === 'needs_attention' ? 'orange' : 'blue'} />
      </View>
      <Text variant="h2" color={colors.white}>{app.plan ? `${app.plan.retailer} · ${app.plan.name}` : 'Plan to be recommended'}</Text>
      {app.estimatedSavingYearly > 0 ? (
        <View>
          <Text variant="caption" color={ON_HERO}>Estimated savings</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <CountUp variant="figure" color="#FFB35C" value={app.estimatedSavingYearly} format={(n) => money(n)} />
            <Text variant="body" color={ON_HERO}>/year</Text>
          </View>
        </View>
      ) : null}
      <View style={s.progress} accessibilityLabel={`Step ${done} of ${app.stages.length}`}>
        {app.stages.map((st) => <View key={st.key} style={[s.seg, st.state === 'done' && { backgroundColor: colors.orange }, st.state === 'current' && { backgroundColor: 'rgba(255,255,255,0.7)' }]} />)}
      </View>
      <Text variant="small" color={colors.white}>{active ? 'Your new plan is active.' : `Now: ${current?.label}`}</Text>
      <Button label="View my switch" variant="light" onPress={() => router.navigate('/application')} />
    </View>
  );
}

function StartSummary({ quote }: { quote: SavingsQuote | null }) {
  const rec = quote?.recommended;
  return (
    <View style={s.summary}>
      <Text variant="h2" color={colors.white}>
        {rec ? `You could save ${money(rec.savingYearly)} a year.` : 'See what you could save in 30 seconds.'}
      </Text>
      <Text variant="small" color={ON_HERO}>
        {rec ? `With ${rec.plan.retailer} ${rec.plan.name}. Send us your latest bill and we’ll handle the switch.` : 'Tell us your usage and current plan, and we’ll compare every plan for you.'}
      </Text>
      {rec ? (
        <Button label="Submit my bill" variant="light" icon="camera-outline" onPress={() => router.push({ pathname: '/invoice', params: { planId: rec.plan.id, quoteId: quote!.id, saving: String(rec.savingYearly) } })} />
      ) : (
        <Button label="Check my savings" variant="light" icon="flash-outline" onPress={() => router.navigate('/savings')} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  // Full-bleed: undo the screen's padding so the navy runs edge to edge and under the status bar.
  hero: {
    marginTop: -space.xl, marginHorizontal: -space.xl, paddingHorizontal: space.xl, paddingBottom: space.x3, gap: space.lg,
    backgroundColor: colors.hero,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logoPlate: { backgroundColor: colors.white, borderRadius: radius.sm, paddingVertical: 6, paddingHorizontal: 10 },
  logo: { height: 26, width: 26 * (314 / 112) },
  bell: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  badge: { position: 'absolute', top: 10, right: 11, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.orange, borderWidth: 1.5, borderColor: colors.hero },
  summary: { gap: space.md },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 5, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
});
