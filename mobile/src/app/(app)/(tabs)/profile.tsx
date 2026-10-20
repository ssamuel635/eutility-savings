// Account, laid out like an Instagram profile rather than a settings list:
// who you are and what you've achieved at a glance (saving, points, friends
// switched), the two things people come here to do (edit, share their code),
// then the settings. Icons in one colour so the lists read calmly.

import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button, Card, ListRow, Screen, Section, Text, Toggle } from '@/components';
import { api, type Plan } from '@/api';
import { useQuery } from '@/hooks/useQuery';
import { displayPhone, money, monthLabel } from '@/lib/format';
import { pointsFor, shareMessage } from '@/lib/rewards';
import { contact, generalMessage, openEmail, openWhatsApp } from '@/lib/whatsapp';
import { useCustomer, useSession } from '@/state/session';
import { colors, fonts, space } from '@/theme';

const SITE = 'https://eutility-savings.vercel.app';

/** Alert.alert has no buttons on web, so fall back to confirm() there. */
function confirmThen(title: string, message: string, action: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n\n${message}`)) run();
    return;
  }
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, style: 'destructive', onPress: run }]);
}

export default function Profile() {
  const customer = useCustomer();
  const { signOut, update } = useSession();
  const [plan, setPlan] = useState<Plan | null>(null);
  const { data } = useQuery(async () => {
    const [apps, quote, referrals] = await Promise.all([api.applications.list(), api.savings.latest(), api.referrals.summary()]);
    return { saving: apps[0]?.estimatedSavingYearly || quote?.recommended?.savingYearly || 0, referrals };
  });

  useEffect(() => {
    api.plans.catalogue().then((c) => setPlan(c.plans.find((p) => p.id === customer.currentPlanId) ?? null), () => {});
  }, [customer.currentPlanId]);

  const initials = customer.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const setPref = (k: keyof typeof customer.preferences) => (v: boolean) => update({ preferences: { ...customer.preferences, [k]: v } }).catch(() => {});
  const switched = data?.referrals.successful ?? 0;
  const share = () => data && Share.share({ message: shareMessage(data.referrals.code, data.referrals.link) });

  return (
    <Screen tabs>
      {/* Who you are, and what you've got out of Eutility so far */}
      <View style={s.head}>
        <View style={s.avatar}><Text style={s.initials}>{initials}</Text></View>
        <View style={s.stats}>
          <Stat value={data ? (data.saving > 0 ? money(data.saving) : '—') : ' '} label="Saving / yr" accent />
          <Stat value={data ? pointsFor(switched).toLocaleString('en-SG') : ' '} label="Points" />
          <Stat value={data ? String(switched) : ' '} label="Friends switched" />
        </View>
      </View>
      <View style={{ gap: 2, marginTop: -space.sm }}>
        <Text variant="h2">{customer.fullName}</Text>
        <Text variant="small">+65 {displayPhone(customer.phone)}</Text>
        <Text variant="caption">Member since {monthLabel(customer.createdAt.slice(0, 7))} · {customer.id}</Text>
      </View>
      <View style={s.actions}>
        <Button label="Edit profile" variant="secondary" small style={{ flex: 1 }} onPress={() => router.push('/profile-edit')} />
        <Button label="Share my code" variant="secondary" icon="share-social-outline" small style={{ flex: 1 }} onPress={share} />
      </View>

      <Section title="Your details">
        <Card>
          <ListRow icon="mail-outline" tone="blue" label="Email" value={customer.email} />
          <ListRow icon="home-outline" tone="blue" label="Address" value={`${customer.address}, Singapore ${customer.postal}`} />
          <ListRow icon="business-outline" tone="blue" label="Home type" value={customer.dwelling} last />
        </Card>
      </Section>

      <Section title="Electricity">
        <Card>
          <ListRow icon="flash-outline" tone="blue" label="Current plan" value={plan ? `${plan.retailer} · ${plan.name}` : 'Not set yet'} onPress={() => router.navigate('/savings')} />
          <ListRow icon="speedometer-outline" tone="blue" label="Monthly usage" value={customer.monthlyKwh ? `${customer.monthlyKwh} kWh` : 'Not set yet'} onPress={() => router.navigate('/savings')} last />
        </Card>
      </Section>

      <Section title="Notifications">
        <Card>
          <Toggle label="App notifications" hint="When your switch moves to the next step." value={customer.preferences.pushNotifications} onChange={setPref('pushNotifications')} />
          <Toggle label="WhatsApp updates" hint="The same updates, on WhatsApp." value={customer.preferences.whatsappUpdates} onChange={setPref('whatsappUpdates')} />
        </Card>
      </Section>

      <Section title="Help">
        <Card>
          <ListRow icon="logo-whatsapp" tone="blue" label="Chat on WhatsApp" onPress={() => openWhatsApp(generalMessage())} />
          <ListRow icon="mail-outline" tone="blue" label={`Email ${contact.email}`} onPress={() => openEmail(generalMessage(), 'Question from the Eutility app')} />
          <ListRow icon="help-circle-outline" tone="blue" label="FAQ" onPress={() => Linking.openURL(`${SITE}/faq.html`)} />
          <ListRow icon="document-text-outline" tone="blue" label="Terms and conditions" onPress={() => Linking.openURL(`${SITE}/legal.html#terms`)} />
          <ListRow icon="shield-checkmark-outline" tone="blue" label="Privacy statement" onPress={() => Linking.openURL(`${SITE}/legal.html#privacy`)} last />
        </Card>
      </Section>

      <Button label="Sign out" variant="ghost" icon="log-out-outline" onPress={() => confirmThen('Sign out?', 'You can sign back in with your phone number.', 'Sign out', signOut)} />

      <Text variant="caption" center>Eutility app v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <View style={s.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={[s.statValue, accent && { color: colors.orangeDisplay }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text variant="caption" center numberOfLines={2}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.md },
  avatar: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: colors.blue, backgroundColor: colors.blueTint, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.head, fontSize: 28, lineHeight: 34, color: colors.navy },
  stats: { flex: 1, flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingHorizontal: 2 },
  statValue: { fontFamily: fonts.head, fontSize: 19, lineHeight: 24, color: colors.ink },
  actions: { flexDirection: 'row', gap: space.sm },
});
