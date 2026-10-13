// New account, after the phone number is verified. Kept short: electricity
// details come later from the savings check and the bill.

import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Button, ChipGroup, ErrorNote, Field, Screen, Text } from '@/components';
import { api, ApiError, type Dwelling } from '@/api';
import { useSession } from '@/state/session';
import { space } from '@/theme';

const DWELLINGS: Dwelling[] = ['HDB 1- or 2-room', 'HDB 3-room', 'HDB 4-room', 'HDB 5-room', 'HDB Executive', 'Condominium / Apartment', 'Landed property'];

const rules = {
  fullName: (v: string) => (v.trim().length >= 2 ? '' : 'Enter your full name.'),
  email: (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'Enter a valid email address.'),
  address: (v: string) => (v.trim().length >= 5 ? '' : 'Enter your street address.'),
  postal: (v: string) => (/^\d{6}$/.test(v.trim()) ? '' : 'Singapore postal codes have 6 digits.'),
  password: (v: string) => (!v || v.length >= 8 ? '' : 'Use at least 8 characters, or leave it blank.'),
};
type Key = keyof typeof rules;

export default function Register() {
  const { token = '', phone = '' } = useLocalSearchParams<{ token: string; phone: string }>();
  const { begin } = useSession();
  const [form, setForm] = useState({ fullName: '', email: '', address: '', postal: '', password: '', referredBy: '' });
  const [dwelling, setDwelling] = useState<Dwelling>('HDB 4-room');
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const errors = Object.fromEntries((Object.keys(rules) as Key[]).map((k) => [k, rules[k](form[k])])) as Record<Key, string>;
  const err = (k: Key) => (showErrors ? errors[k] || undefined : undefined);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    setShowErrors(true);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    setError('');
    try {
      const session = await api.auth.register(token, {
        fullName: form.fullName,
        email: form.email,
        address: form.address,
        postal: form.postal,
        dwelling,
        password: form.password || undefined,
        referredBy: form.referredBy.trim() || undefined,
      });
      await begin(session);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'We couldn’t create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      edges={['bottom']}
      footer={
        <>
          <Text variant="caption" center>
            By creating an account you agree to Eutility’s Terms and Privacy Policy, and to us contacting you about your switch.
          </Text>
          <Button label="Create account" loading={busy} onPress={submit} />
        </>
      }
    >
      <View style={{ gap: space.sm }}>
        <Text variant="h1">A few details</Text>
        <Text variant="body">+65 {phone} is verified. Tell us who you are and where you live.</Text>
      </View>
      <Field label="Full name" value={form.fullName} onChangeText={set('fullName')} autoComplete="name" textContentType="name" error={err('fullName')} />
      <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={err('email')} hint="For your switch confirmation and contract." />
      <Field label="Address" value={form.address} onChangeText={set('address')} autoComplete="street-address" placeholder="Blk 123 Sample St 11, #08-45" error={err('address')} />
      <Field label="Postal code" value={form.postal} onChangeText={(t) => set('postal')(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="postal-code" error={err('postal')} />
      <ChipGroup label="Home type" options={DWELLINGS.map((d) => ({ value: d, label: d }))} value={dwelling} onChange={setDwelling} />
      <Field label="Password (optional)" value={form.password} onChangeText={set('password')} secureTextEntry autoComplete="new-password" error={err('password')} hint="Lets you sign in by email if you can’t get an SMS." />
      <Field label="Referral code (optional)" value={form.referredBy} onChangeText={(t) => set('referredBy')(t.toUpperCase())} autoCapitalize="characters" hint="Did a friend send you? Enter their code." />
      {error ? <ErrorNote message={error} /> : null}
    </Screen>
  );
}
