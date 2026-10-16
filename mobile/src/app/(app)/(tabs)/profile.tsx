import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button, Card, ListRow, Screen, Section, Text, Toggle } from '@/components';
import { PhotoHeader } from '@/components/PhotoHeader';
import { api, type Plan } from '@/api';
import { displayPhone } from '@/lib/format';
import { contact, generalMessage, openEmail, openWhatsApp } from '@/lib/whatsapp';
import { useCustomer, useSession } from '@/state/session';
import { colors, space } from '@/theme';

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
  const { signOut, update, refresh } = useSession();
  const [plan, setPlan] = useState<Plan | null>(null);

  useEffect(() => {
    api.plans.catalogue().then((c) => setPlan(c.plans.find((p) => p.id === customer.currentPlanId) ?? null), () => {});
  }, [customer.currentPlanId]);

  const initials = customer.fullName.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const setPref = (k: keyof typeof customer.preferences) => (v: boolean) => update({ preferences: { ...customer.preferences, [k]: v } }).catch(() => {});

  return (
    <Screen tabs edges={[]}>
      <PhotoHeader photo="corridor" title={customer.fullName} subtitle={`+65 ${displayPhone(customer.phone)} · ${customer.id}`} ratio={16 / 10}
        badge={<View style={s.avatar}><Text variant="h2" color={colors.white}>{initials}</Text></View>} />

      <Section title="Your details" action={<Button label="Edit" variant="ghost" small onPress={() => router.push('/profile-edit')} />}>
        <Card>
          <ListRow icon="mail" tone="blue" label="Email" value={customer.email} />
          <ListRow icon="home" tone="orange" label="Address" value={`${customer.address}, Singapore ${customer.postal}`} />
          <ListRow icon="business" tone="navy" label="Home type" value={customer.dwelling} last />
        </Card>
      </Section>

      <Section title="Electricity">
        <Card>
          <ListRow icon="flash" tone="blue" label="Current plan" value={plan ? `${plan.retailer} · ${plan.name}` : 'Not set yet'} onPress={() => router.navigate('/savings')} />
          <ListRow icon="speedometer" tone="teal" label="Monthly usage" value={customer.monthlyKwh ? `${customer.monthlyKwh} kWh` : 'Not set yet'} onPress={() => router.navigate('/savings')} last />
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
          <ListRow icon="logo-whatsapp" tone="green" label="Chat on WhatsApp" onPress={() => openWhatsApp(generalMessage())} />
          <ListRow icon="mail" tone="blue" label={`Email ${contact.email}`} onPress={() => openEmail(generalMessage(), 'Question from the Eutility app')} />
          <ListRow icon="help-circle" tone="orange" label="FAQ" onPress={() => Linking.openURL(`${SITE}/faq.html`)} />
          <ListRow icon="document-text" tone="navy" label="Terms and conditions" onPress={() => Linking.openURL(`${SITE}/legal.html#terms`)} />
          <ListRow icon="shield-checkmark" tone="teal" label="Privacy statement" onPress={() => Linking.openURL(`${SITE}/legal.html#privacy`)} last />
        </Card>
      </Section>

      <Button label="Sign out" variant="secondary" icon="log-out-outline" onPress={() => confirmThen('Sign out?', 'You can sign back in with your phone number.', 'Sign out', signOut)} />


      <Text variant="caption" center>Eutility app v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.white, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
});
