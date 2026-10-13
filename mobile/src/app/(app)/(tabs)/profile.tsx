import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import { Button, Card, ListRow, Screen, Section, Text, Toggle } from '@/components';
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
    <Screen tabs>
      <View style={s.head}>
        <View style={s.avatar}><Text variant="h2" color={colors.white}>{initials}</Text></View>
        <View style={{ flex: 1 }}>
          <Text variant="h2">{customer.fullName}</Text>
          <Text variant="caption">+65 {displayPhone(customer.phone)} · {customer.id}</Text>
        </View>
      </View>

      <Section title="Your details" action={<Button label="Edit" variant="ghost" small onPress={() => router.push('/profile-edit')} />}>
        <Card>
          <ListRow icon="mail-outline" label="Email" value={customer.email} />
          <ListRow icon="home-outline" label="Address" value={`${customer.address}, Singapore ${customer.postal}`} />
          <ListRow icon="business-outline" label="Home type" value={customer.dwelling} last />
        </Card>
      </Section>

      <Section title="Electricity">
        <Card>
          <ListRow icon="flash-outline" label="Current plan" value={plan ? `${plan.retailer} · ${plan.name}` : 'Not set yet'} onPress={() => router.navigate('/savings')} />
          <ListRow icon="speedometer-outline" label="Monthly usage" value={customer.monthlyKwh ? `${customer.monthlyKwh} kWh` : 'Not set yet'} onPress={() => router.navigate('/savings')} last />
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
          <ListRow icon="logo-whatsapp" label="Chat on WhatsApp" onPress={() => openWhatsApp(generalMessage())} />
          <ListRow icon="mail-outline" label={`Email ${contact.email}`} onPress={() => openEmail(generalMessage(), 'Question from the Eutility app')} />
          <ListRow icon="help-circle-outline" label="FAQ" onPress={() => Linking.openURL(`${SITE}/faq`)} />
          <ListRow icon="document-text-outline" label="Terms & privacy" onPress={() => Linking.openURL(`${SITE}/legal`)} last />
        </Card>
      </Section>

      <Button label="Sign out" variant="danger" icon="log-out-outline" onPress={() => confirmThen('Sign out?', 'You can sign back in with your phone number.', 'Sign out', signOut)} />


      <Text variant="caption" center>Eutility app v{Constants.expoConfig?.version ?? '1.0.0'}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
});
